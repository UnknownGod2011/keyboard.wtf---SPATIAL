import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { RoundButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RoundButton"
import { ElementContent } from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import { TextInputField } from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { Interactor, TargetingMode } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import { CompanionStatus, DesktopFrame, Selection, SelectionAttempt, SpatialBridge } from "./SpatialBridge"

type Mode = "desktop" | "snip" | "context" | "jarvis" | "settings"
type Voice = "ready" | "listening" | "review" | "sending" | "sent"

const WIDTH = 58
const HEIGHT = 43
const SCREEN_WIDTH = 54
const SCREEN_HEIGHT = 23
const INK = new vec4(0.88, 0.98, 1, 1)
const CYAN = new vec4(0.38, 0.92, 1, 1)
const DISPLAY_MATERIAL = requireAsset("../Spatial Display.mat") as Material
const ORB_TEXTURE = requireAsset("../Jarvis Orb.png") as Texture

@component
export class Spatial extends BaseScriptComponent {
  @input
  @hint("Loopback Windows companion address. HTTP is for Preview development.")
  endpoint: string = "http://127.0.0.1:48790"

  @input
  @hint("Session credential from bridge.local.json. Use only in a local project copy.")
  pairingToken: string = ""

  private bridge!: SpatialBridge
  private frame!: Frame
  private host!: SceneObject
  private display!: Image
  private screen!: SceneObject
  private popup!: BackPlate
  private frameSize = new vec2(16, 9)
  private indicator!: Text
  private message!: Text
  private title!: Text
  private orb!: SceneObject
  private controls!: SceneObject
  private entry!: TextInputField
  private regionTarget!: SceneObject
  private regionOutline!: SceneObject
  private regionStart: vec2 | null = null
  private regionEnd: vec2 | null = null
  private regionDeadline = 0
  private frameSequence = 0
  private mode: Mode = "desktop"
  private voice: Voice = "ready"
  private status: CompanionStatus | null = null
  private selection: Selection | null = null
  private asr: AsrModule | null = null
  private inputMode = "typed"
  private epoch = 0
  private pending = false
  private closed = false
  private streaming = true
  private screenBusy = false
  private lastPoll = 0
  private lastFrame = 0
  private scale = 1

  onAwake(): void {
    this.bridge = new SpatialBridge(this.endpoint, this.pairingToken.trim())
    this.sceneObject.createComponent("Component.Canvas")
    this.frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    this.frame.autoShowHide = false
    this.frame.autoScaleContent = false
    this.frame.allowTranslation = true
    this.frame.allowScaling = false
    this.frame.onInitialized.add(() => this.build())
    this.createEvent("OnDestroyEvent").bind(() => this.stopListening())
  }

  private build(): void {
    this.frame.showFollowButton = false
    this.frame.showCloseButton = false
    this.frame.innerSize = new vec2(WIDTH, HEIGHT)
    this.frame.padding = new vec2(1, 1)
    this.frame.setUseFollow(false)
    this.host = this.object("Spatial UI", this.frame.contentTransform.getSceneObject(), 0, 0, 0.6)
    this.label("KEYBOARD.WTF  /  SPATIAL", -11, 18.3, 33, 3, 74, CYAN)
    this.indicator = this.label("PC • OFFLINE", 20, 18.3, 15, 3, 58, INK)
    this.screen = this.object("Live Windows Image", this.host, 0, 0, 0.2)
    if (DISPLAY_MATERIAL) {
      const material = DISPLAY_MATERIAL.clone()
      material.mainPass.depthTest = true
      material.mainPass.depthWrite = false
      this.display = this.screen.createComponent("Component.Image") as Image
      this.display.clearMaterials()
      this.display.addMaterial(material)
    }
    this.buildRegionPicker()
    this.screen.enabled = false
    const popupNode = this.object("Assistant popup", this.host, 0, 0)
    this.popup = popupNode.createComponent(BackPlate.getTypeName()) as BackPlate
    popupNode.enabled = false
    this.title = this.label("DESKTOP", 0, 12.7, 52, 3, 73, CYAN)
    this.message = this.label("", 0, 0, 49, 18, 64, INK)
    this.controls = this.object("Workflow controls", this.host, 0, 0, 0.25)
    this.entry = this.object("Jarvis transcript", this.host, 0, 2, 0.25)
      .createComponent(TextInputField.getTypeName()) as TextInputField
    this.entry.size = new vec3(44, 5, 1)
    this.entry.getSceneObject().enabled = false

    this.button(this.host, "Cursivis", -19, -17, 12, () => this.capture())
    const jarvisButton = this.button(this.host, "Jarvis", -7, -17, 7, () => this.listen(), true)
    this.orb = this.object("Jarvis glow", jarvisButton, 0, 0, 0.7)
    const orbImage = this.orb.createComponent("Component.Image") as Image
    const orbMaterial = DISPLAY_MATERIAL.clone()
    orbMaterial.mainPass.baseTex = ORB_TEXTURE
    orbMaterial.mainPass.depthWrite = false
    orbImage.clearMaterials()
    orbImage.addMaterial(orbMaterial)
    this.button(this.host, "Settings", 3, -17, 11, () => this.settings())
    this.button(this.host, "−", 12, -17, 5, () => this.resize(-0.1))
    this.button(this.host, "+", 18, -17, 5, () => this.resize(0.1))
    this.button(this.host, "×", 24, -17, 5, () => this.back())

    this.showDesktop()
    this.createEvent("UpdateEvent").bind(() => this.update())
    print("SPATIAL workspace ready")
  }

  private object(name: string, parent: SceneObject, x: number, y: number, z = 0): SceneObject {
    const node = global.scene.createSceneObject(name)
    node.setParent(parent)
    node.getTransform().setLocalPosition(new vec3(x, y, z))
    return node
  }

  private label(value: string, x: number, y: number, w: number, h: number, size: number, color: vec4): Text {
    const node = this.object(value || "Workflow message", this.host, x, y, 0.24)
    const label = node.createComponent("Component.Text") as Text
    label.text = value
    label.size = size
    label.textFill.color = color
    label.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    label.horizontalAlignment = HorizontalAlignment.Center
    label.verticalAlignment = VerticalAlignment.Center
    label.horizontalOverflow = HorizontalOverflow.Wrap
    label.verticalOverflow = VerticalOverflow.Truncate
    label.depthTest = true
    return label
  }

  private button(
    parent: SceneObject, name: string, x: number, y: number, width: number,
    handler: () => void, round = false,
  ): SceneObject {
    const node = this.object(name, parent, x, y, 0.05)
    if (round) {
      const button = node.createComponent(RoundButton.getTypeName()) as RoundButton
      button.width = width
      button.onTriggerUp.add(handler)
    } else {
      const button = node.createComponent(Button.getTypeName()) as Button
      button.size = new vec3(width, 5, 1)
      button.onTriggerUp.add(handler)
    }
    const content = node.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = name
    content.textSize = 54
    return node
  }

  private resize(change: number): void {
    this.scale = Math.max(0.82, Math.min(1.36, this.scale + change))
    this.sceneObject.getTransform().setLocalScale(new vec3(this.scale, this.scale, this.scale))
  }

  private update(): void {
    if (this.closed) return
    const now = getTime()
    const pulse = this.voice === "listening" || this.voice === "sending" ? 0.055 : 0.022
    const glow = 1 + Math.sin(now * (this.voice === "listening" ? 6 : 3)) * pulse
    const orbTransform = this.orb.getTransform()
    orbTransform.setLocalScale(new vec3(7.6 * glow, 7.6 * glow, 1))
    orbTransform.setLocalPosition(new vec3(0, 0.35 * Math.sin(now * 2), 0.7))
    if (this.mode === "snip" && now > this.regionDeadline) {
      this.selectionError(new Error("Snip timed out. Start a new region on the live desktop."))
    }
    if (!this.screenBusy && now - this.lastPoll > 0.5 && this.showsMirror() && this.mode !== "snip") {
      this.lastPoll = now
      this.poll()
    }
  }

  private async poll(): Promise<void> {
    if (!this.pairingToken || !this.streaming) return
    this.screenBusy = true
    try {
      if (!this.status || getTime() - this.lastFrame > 2) {
        this.status = await this.bridge.request<CompanionStatus>("/status")
      }
      if (!this.showsMirror() || !this.streaming) return
      if (!this.status.stream) {
        this.screen.enabled = false
        if (this.mode === "desktop") this.desktopMessage("PC connected. Screen sharing is paused on Windows.")
        this.indicator.text = "PC • READY"
        return
      }
      if (!this.display) {
        this.desktopMessage("Assign the live image material in Lens Studio.")
        return
      }
      const frame = await this.bridge.request<DesktopFrame>("/frame")
      const texture = await new Promise<Texture>((resolve, reject) => {
        Base64.decodeTextureAsync(frame.jpeg, resolve, () => reject(new Error("Could not decode the Windows frame.")))
      })
      if (!this.showsMirror() || this.mode === "snip" || this.closed || !this.streaming) return
      this.frameSize = new vec2(frame.width, frame.height)
      this.frameSequence = frame.sequence
      this.layoutMirror()
      this.display.mainPass.baseTex = texture
      this.screen.enabled = true
      if (this.mode === "desktop") this.message.text = ""
      if (!this.lastFrame) print("SPATIAL first live Windows texture")
      this.lastFrame = getTime()
      this.indicator.text = "PC • LIVE"
    } catch (error) {
      if (this.mode === "snip") return
      this.status = null
      this.lastPoll = getTime() + 1
      this.indicator.text = "PC • OFFLINE"
      this.screen.enabled = false
      if (this.mode === "desktop") this.desktopMessage(String(error))
    } finally {
      this.screenBusy = false
    }
  }

  private desktopMessage(text: string): void {
    this.screen.enabled = false
    this.message.text = text
  }

  private showsMirror(): boolean {
    return this.mode !== "settings"
  }

  private layoutMirror(): void {
    const alongside = this.mode === "jarvis" || this.mode === "context"
    const width = alongside ? 26 : SCREEN_WIDTH
    const factor = Math.min(width / this.frameSize.x, SCREEN_HEIGHT / this.frameSize.y)
    const transform = this.screen.getTransform()
    transform.setLocalPosition(new vec3(alongside ? -14 : 0, 0, 0.2))
    transform.setLocalScale(new vec3(this.frameSize.x * factor, this.frameSize.y * factor, 1))
  }

  private panel(mode: Mode, title: string, message: string): void {
    this.mode = mode
    const jarvis = mode === "jarvis"
    const alongside = jarvis || mode === "context"
    const x = alongside ? 14 : 0
    this.regionTarget.enabled = mode === "snip"
    this.regionOutline.enabled = false
    this.regionStart = this.regionEnd = null
    const popupNode = this.popup.getSceneObject()
    popupNode.enabled = alongside || mode === "settings"
    if (popupNode.enabled) {
      this.popup.size = new vec2(alongside ? 27 : 53, 30)
      popupNode.getTransform().setLocalPosition(new vec3(x, 0, -0.8))
    }
    this.title.text = title
    this.title.layoutRect = Rect.create(alongside ? -13 : -26, alongside ? 13 : 26, -1.5, 1.5)
    this.title.getSceneObject().getTransform().setLocalPosition(new vec3(x, 12.7, 0.24))
    if (!this.showsMirror() || !this.streaming) this.screen.enabled = false
    this.layoutMirror()
    this.message.text = message
    const textWidth = alongside ? 12.5 : 24.5
    this.message.layoutRect = Rect.create(-textWidth, textWidth, -9, 9)
    this.message.getSceneObject().getTransform().setLocalPosition(new vec3(x, mode === "snip" ? -12.8 : 0, 0.24))
    this.controls.getTransform().setLocalPosition(new vec3(x, 0, 0.25))
    for (let i = this.controls.getChildrenCount() - 1; i >= 0; i--) {
      this.controls.getChild(i).destroy()
    }
    this.entry.getSceneObject().enabled = false
    this.entry.getSceneObject().getTransform().setLocalPosition(new vec3(x, 2, 0.25))
    this.entry.size = new vec3(jarvis ? 24 : 44, 5, 1)
  }

  private showDesktop(): void {
    this.panel("desktop", "WINDOWS DESKTOP", this.pairingToken ? "Connecting to Windows…" : "Pair the Windows companion in the Spatial inspector.")
  }

  private reset(): void {
    this.epoch++
    this.pending = false
    this.selection = null
    this.voice = "ready"
    this.stopListening()
    this.entry.text = ""
  }

  private back(): void {
    if (this.mode === "desktop") {
      this.closed = true
      this.sceneObject.enabled = false
      return
    }
    this.reset()
    if (this.pairingToken) this.bridge.request("/clear", {}).catch(() => {})
    this.showDesktop()
  }

  private async capture(forceSnip = false): Promise<void> {
    this.reset()
    if (forceSnip) {
      this.beginRegion()
      return
    }
    const epoch = this.epoch
    this.panel("context", "CURSIVIS", "Checking for newly copied text…")
    try {
      const result = await this.bridge.request<SelectionAttempt>("/selection", {})
      if (epoch !== this.epoch) return
      if ("needsRegion" in result) {
        this.beginRegion()
      } else {
        await this.requestSuggestions(result, epoch)
      }
    } catch (error) {
      if (epoch === this.epoch) this.selectionError(error)
    }
  }

  private buildRegionPicker(): void {
    this.regionTarget = this.object("Cursivis selection surface", this.screen, 0, 0, 0.4)
    const collider = this.regionTarget.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(1, 1, 0.45)
    collider.shape = box
    const target = this.regionTarget.createComponent(Interactable.getTypeName()) as Interactable
    target.colliders = [collider]
    target.targetingMode = TargetingMode.Direct | TargetingMode.Indirect
    target.allowMultipleInteractors = false
    target.keepHoverOnTrigger = true
    this.regionTarget.enabled = false

    this.regionOutline = this.object("Cursivis snip outline", this.screen, 0, 0, 0.8)
    const material = DISPLAY_MATERIAL.clone()
    const texture = ProceduralTextureProvider.createWithFormat(1, 1, TextureFormat.RGBA8Unorm)
    const pixels = texture.control as ProceduralTextureProvider
    pixels.setPixels(0, 0, 1, 1, new Uint8Array([97, 235, 255, 255]))
    material.mainPass.baseTex = texture
    for (let i = 0; i < 4; i++) {
      const node = this.object("Snip edge", this.regionOutline, 0, 0)
      const image = node.createComponent("Component.Image") as Image
      image.clearMaterials()
      image.addMaterial(material)
    }
    this.regionOutline.enabled = false
    target.onTriggerStart.add(event => {
      if (this.mode === "snip") this.regionStart = this.regionPoint(event.interactor)
    })
    target.onTriggerUpdate.add(event => this.updateRegion(event.interactor))
    target.onTriggerEnd.add(event => this.finishRegion(event.interactor))
    target.onTriggerEndOutside.add(event => this.finishRegion(event.interactor))
    target.onTriggerCanceled.add(() => {
      this.regionStart = this.regionEnd = null
      this.regionOutline.enabled = false
    })
  }

  private beginRegion(): void {
    if (!this.streaming || !this.screen.enabled || !this.frameSequence) {
      this.selectionError(new Error("Wait for the live Windows desktop before starting a snip."))
      return
    }
    this.panel("snip", "CURSIVIS  /  PINCH AND DRAG TO SNIP", "Release to capture   •   × to cancel")
    this.regionDeadline = getTime() + 45
  }

  private regionPoint(interactor: Interactor): vec2 | null {
    const {startPoint, direction} = interactor
    if (!startPoint) return null
    const inverse = this.screen.getTransform().getInvertedWorldTransform()
    let point = inverse.multiplyPoint(startPoint)
    if (interactor.activeTargetingMode !== TargetingMode.Direct && direction) {
      const ray = inverse.multiplyDirection(direction)
      if (Math.abs(ray.z) < 0.00001) return null
      const distance = -point.z / ray.z
      if (distance < 0) return null
      point = point.add(ray.uniformScale(distance))
    }
    return new vec2(Math.max(-0.5, Math.min(0.5, point.x)), Math.max(-0.5, Math.min(0.5, point.y)))
  }

  private updateRegion(interactor: Interactor): void {
    const start = this.regionStart
    if (this.mode !== "snip" || !start) return
    const end = this.regionPoint(interactor)
    if (!end) return
    this.regionEnd = end
    const w = Math.abs(start.x - end.x)
    const h = Math.abs(start.y - end.y)
    const x = (start.x + end.x) / 2
    const y = (start.y + end.y) / 2
    const edges = [
      [x, start.y, w, 0.007], [x, end.y, w, 0.007],
      [start.x, y, 0.004, h], [end.x, y, 0.004, h],
    ]
    edges.forEach(([px, py, sx, sy], i) => {
      const transform = this.regionOutline.getChild(i).getTransform()
      transform.setLocalPosition(new vec3(px, py, 0))
      transform.setLocalScale(new vec3(sx, sy, 1))
    })
    this.regionOutline.enabled = w > 0 && h > 0
  }

  private async finishRegion(interactor: Interactor): Promise<void> {
    if (this.mode !== "snip") return
    this.updateRegion(interactor)
    const start = this.regionStart
    const end = this.regionEnd
    this.regionStart = this.regionEnd = null
    this.regionOutline.enabled = false
    if (!start || !end || Math.abs(start.x - end.x) * this.frameSize.x < 8 ||
        Math.abs(start.y - end.y) * this.frameSize.y < 8) {
      this.message.text = "Drag a larger rectangle   •   × to cancel"
      return
    }
    const epoch = this.epoch
    const sequence = this.frameSequence
    this.panel("context", "CURSIVIS  /  SCREEN SNIP", "Preparing the selected region…")
    try {
      const result = await this.bridge.request<Selection>("/region", {
        sequence,
        left: Math.min(start.x, end.x) + 0.5,
        top: 0.5 - Math.max(start.y, end.y),
        right: Math.max(start.x, end.x) + 0.5,
        bottom: 0.5 - Math.min(start.y, end.y),
      })
      if (epoch !== this.epoch) return
      await this.requestSuggestions(result, epoch)
    } catch (error) {
      if (epoch === this.epoch) this.selectionError(error)
    }
  }

  private async requestSuggestions(selection: Selection, epoch: number): Promise<void> {
    this.selection = selection
    this.panel("context", "CURSIVIS  /  FINDING ACTIONS", selection.excerpt)
    const ranked = await this.bridge.request<{actions: string[]}>("/suggest", {revision: selection.revision})
    if (epoch === this.epoch && this.selection === selection) this.suggestions(selection, ranked.actions)
  }

  private selectionError(error: unknown): void {
    this.panel("context", "CURSIVIS", String(error))
    this.button(this.controls, "Retry", -6.5, -11, 10, () => {
      if (!this.selection) {
        this.capture()
        return
      }
      const epoch = this.epoch
      this.requestSuggestions(this.selection, epoch).catch(reason => {
        if (epoch === this.epoch) this.selectionError(reason)
      })
    })
    this.button(this.controls, "Snip screen", 5.7, -11, 14, () => this.capture(true))
  }

  private suggestions(selection: Selection, actions: string[]): void {
    this.panel("context", selection.characters ? "CURSIVIS  /  " + selection.characters + " CHARS" : "CURSIVIS  /  IMAGE", selection.excerpt)
    this.message.layoutRect = Rect.create(-12, 12, -2, 2)
    this.message.getSceneObject().getTransform().setLocalPosition(new vec3(14, 8, 0.24))
    this.button(this.controls, "Snip screen", 0, 3.2, 17, () => this.capture(true))
    actions.forEach((action, index) => {
      const name = action[0].toUpperCase() + action.slice(1).replace(/_/g, " ")
      this.button(this.controls, name, 0, -2 - index * 5.4, 25, () => this.analyze(action))
    })
  }

  private async analyze(action: string): Promise<void> {
    if (this.pending || !this.selection) return
    const epoch = ++this.epoch
    this.pending = true
    this.panel("context", "CURSIVIS  /  WORKING", "Analyzing your Windows selection…")
    try {
      const result = await this.bridge.request<{result: string, model: string}>("/analyze", {
        revision: this.selection.revision, action,
      })
      if (epoch === this.epoch) {
        const pages = result.result.match(/[\s\S]{1,135}/g) || []
        this.resultPage(pages, 0, result.model)
      }
    } catch (error) {
      if (epoch === this.epoch) {
        this.panel("context", "CURSIVIS", String(error))
        this.button(this.controls, "Retry", 0, -11, 12, () => this.analyze(action))
      }
    } finally {
      if (epoch === this.epoch) this.pending = false
    }
  }

  private resultPage(pages: string[], index: number, model: string): void {
    this.panel("context", "CURSIVIS  /  " + (index + 1) + " OF " + pages.length, pages[index])
    if (index > 0) this.button(this.controls, "Previous", -6, -11, 12, () => this.resultPage(pages, index - 1, model))
    if (index + 1 < pages.length) this.button(this.controls, "Next", 6.5, -11, 10, () => this.resultPage(pages, index + 1, model))
  }

  private async listen(): Promise<void> {
    this.reset()
    const epoch = this.epoch
    this.panel("jarvis", "JARVIS  /  READY", "Checking Windows permissions…")
    try {
      this.status = await this.bridge.request<CompanionStatus>("/status")
      if (epoch !== this.epoch) return
      if (!this.status.jarvis) throw new Error("Enable Jarvis on Windows.")
      if (!this.status.microphone) {
        this.review("", "typed")
        return
      }
      this.panel("jarvis", "JARVIS  /  LISTENING", "Say a command. You will review it before it goes to Windows.")
      this.voice = "listening"
      this.button(this.controls, "Type instead", 0, -10, 18, () => this.review("", "typed"))
      this.asr = require("LensStudio:AsrModule") as AsrModule
      const options = AsrModule.AsrTranscriptionOptions.create()
      options.silenceUntilTerminationMs = 1000
      options.onTranscriptionUpdateEvent.add(event => {
        if (epoch === this.epoch && this.voice === "listening" && event.isFinal && event.text.trim()) {
          this.review(event.text.trim(), "voice")
        }
      })
      options.onTranscriptionErrorEvent.add(code => {
        if (epoch !== this.epoch || this.voice !== "listening") return
        print("SPATIAL ASR status " + code)
        const message = code === AsrModule.AsrStatusCode.Unauthenticated
          ? "SPECS voice needs a successful sign-in. Type here or speak to Jarvis directly on Windows."
          : "SPECS voice is unavailable. Type here or speak to Jarvis directly on Windows."
        this.review("", "typed", message)
      })
      this.asr.startTranscribing(options)
      const timeout = this.createEvent("DelayedCallbackEvent")
      timeout.bind(() => {
        if (epoch === this.epoch && this.voice === "listening") this.review("", "typed")
      })
      timeout.reset(12)
    } catch (error) {
      if (epoch === this.epoch) this.panel("jarvis", "JARVIS", String(error))
    }
  }

  private stopListening(): void {
    if (this.asr) this.asr.stopTranscribing().catch(() => {})
    this.asr = null
  }

  private review(text: string, input: string, message = "Pinch Send when your command is ready."): void {
    this.voice = "review"
    this.stopListening()
    this.inputMode = input
    this.panel("jarvis", "JARVIS  /  REVIEW", message)
    this.message.getSceneObject().getTransform().setLocalPosition(new vec3(14, -4, 0.24))
    this.entry.text = text
    this.entry.getSceneObject().enabled = true
    this.button(this.controls, "Send", 0, -10, 12, () => this.send())
  }

  private async send(): Promise<void> {
    if (this.voice !== "review" || !this.entry.text.trim()) return
    const text = this.entry.text.trim()
    const epoch = this.epoch
    this.voice = "sending"
    this.panel("jarvis", "JARVIS  /  SENDING", "Sending your confirmed turn to Keyboard.wtf…")
    try {
      const response = await this.bridge.request<{message: string}>("/jarvis", {
        text, input: this.inputMode, confirmed: true,
      })
      if (epoch === this.epoch) {
        this.voice = "sent"
        this.panel("jarvis", "JARVIS  /  SENT", response.message)
        this.button(this.controls, "Talk again", 0, -10, 18, () => this.listen())
      }
    } catch (error) {
      if (epoch === this.epoch) this.panel("jarvis", "JARVIS", String(error))
    }
  }

  private async settings(): Promise<void> {
    this.reset()
    const epoch = this.epoch
    this.panel("settings", "SPATIAL  /  SETTINGS", "Checking the Windows companion…")
    try {
      const status = await this.bridge.request<CompanionStatus>("/status")
      if (epoch !== this.epoch) return
      this.status = status
      const word = (allowed: boolean) => allowed ? "On" : "Off"
      this.panel("settings", "SPATIAL  /  SETTINGS", [
        "PC connected   •   Screen " + word(status.stream && this.streaming),
        "Jarvis " + word(status.jarvis) + "   •   SPECS mic " + word(status.microphone),
        "Cursivis " + word(status.context) + "   •   Copy to share",
        "Pinch confirms   •   Drag the window rail",
      ].join("\n"))
      this.button(this.controls, this.streaming ? "Pause view" : "Resume view", 0, -11, 17, () => {
        this.streaming = !this.streaming
        this.settings()
      })
    } catch (error) {
      if (epoch === this.epoch) this.panel("settings", "SPATIAL  /  SETTINGS", String(error))
    }
  }
}
