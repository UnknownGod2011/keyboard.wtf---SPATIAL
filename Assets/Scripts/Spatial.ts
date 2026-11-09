import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { RoundButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RoundButton"
import { ElementContent } from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import { TextInputField } from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField"
import { CompanionStatus, DesktopFrame, Selection, SpatialBridge } from "./SpatialBridge"

type Mode = "desktop" | "context" | "jarvis" | "settings"
type Voice = "ready" | "listening" | "review" | "sending" | "sent"

const WIDTH = 58
const HEIGHT = 43
const SCREEN_WIDTH = 54
const SCREEN_HEIGHT = 23
const INK = new vec4(0.88, 0.98, 1, 1)
const CYAN = new vec4(0.38, 0.92, 1, 1)
const DISPLAY_MATERIAL = requireAsset("../Spatial Display.mat") as Material

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
    this.orb = this.button(this.host, "Jarvis", -7, -17, 7, () => this.listen(), true)
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
    this.orb.getTransform().setLocalScale(new vec3(glow, glow, 1))
    if (!this.screenBusy && now - this.lastPoll > 0.5 && this.showsMirror()) {
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
      if (!this.showsMirror() || this.closed || !this.streaming) return
      this.frameSize = new vec2(frame.width, frame.height)
      this.layoutMirror()
      this.display.mainPass.baseTex = texture
      this.screen.enabled = true
      if (this.mode === "desktop") this.message.text = ""
      if (!this.lastFrame) print("SPATIAL first live Windows texture")
      this.lastFrame = getTime()
      this.indicator.text = "PC • LIVE"
    } catch (error) {
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
    return this.mode === "desktop" || this.mode === "jarvis"
  }

  private layoutMirror(): void {
    const alongsideJarvis = this.mode === "jarvis"
    const width = alongsideJarvis ? 26 : SCREEN_WIDTH
    const factor = Math.min(width / this.frameSize.x, SCREEN_HEIGHT / this.frameSize.y)
    const transform = this.screen.getTransform()
    transform.setLocalPosition(new vec3(alongsideJarvis ? -14 : 0, 0, 0.2))
    transform.setLocalScale(new vec3(this.frameSize.x * factor, this.frameSize.y * factor, 1))
  }

  private panel(mode: Mode, title: string, message: string): void {
    this.mode = mode
    const jarvis = mode === "jarvis"
    const x = jarvis ? 14 : 0
    const popupNode = this.popup.getSceneObject()
    popupNode.enabled = mode !== "desktop"
    if (mode !== "desktop") {
      this.popup.size = new vec2(jarvis ? 27 : 53, 30)
      popupNode.getTransform().setLocalPosition(new vec3(x, 0, -0.8))
    }
    this.title.text = title
    this.title.layoutRect = Rect.create(jarvis ? -13 : -26, jarvis ? 13 : 26, -1.5, 1.5)
    this.title.getSceneObject().getTransform().setLocalPosition(new vec3(x, 12.7, 0.24))
    if (!this.showsMirror() || !this.streaming) this.screen.enabled = false
    this.layoutMirror()
    this.message.text = message
    this.message.layoutRect = Rect.create(jarvis ? -12.5 : -24.5, jarvis ? 12.5 : 24.5, -9, 9)
    this.message.getSceneObject().getTransform().setLocalPosition(new vec3(x, 0, 0.24))
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

  private async capture(): Promise<void> {
    this.reset()
    const epoch = this.epoch
    this.panel("context", "CURSIVIS", "Reading the text you copied on Windows…")
    try {
      const selection = await this.bridge.request<Selection>("/selection", {})
      if (epoch !== this.epoch) return
      this.selection = selection
      this.panel("context", "CURSIVIS  /  FINDING ACTIONS", selection.excerpt)
      const ranked = await this.bridge.request<{actions: string[]}>("/suggest", {revision: selection.revision})
      if (epoch === this.epoch && this.selection === selection && !this.pending) this.suggestions(selection, ranked.actions)
    } catch (error) {
      if (epoch === this.epoch) {
        this.panel("context", "CURSIVIS", String(error))
        this.button(this.controls, "Retry", 0, -11, 12, () => this.capture())
      }
    }
  }

  private suggestions(selection: Selection, actions: string[]): void {
    this.panel("context", "CURSIVIS  /  " + selection.characters + " CHARS", selection.excerpt)
    this.message.layoutRect = Rect.create(-24.5, 24.5, -5, 5)
    this.message.getSceneObject().getTransform().setLocalPosition(new vec3(0, 5.5, 0.24))
    actions.forEach((action, index) => {
      const name = action[0].toUpperCase() + action.slice(1).replace(/_/g, " ")
      this.button(this.controls, name, 0, -2 - index * 5.4, 30, () => this.analyze(action))
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
        const pages = result.result.match(/[\s\S]{1,240}/g) || []
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
    if (index > 0) this.button(this.controls, "Previous", -17, -11, 13, () => this.resultPage(pages, index - 1, model))
    if (index + 1 < pages.length) this.button(this.controls, "Next", 17, -11, 11, () => this.resultPage(pages, index + 1, model))
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
      options.onTranscriptionErrorEvent.add(() => {
        if (epoch === this.epoch && this.voice === "listening") this.review("", "typed")
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

  private review(text: string, input: string): void {
    this.voice = "review"
    this.stopListening()
    this.inputMode = input
    this.panel("jarvis", "JARVIS  /  REVIEW", "Pinch Send when your command is ready.")
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
