export type CompanionStatus = {
  stream: boolean
  context: boolean
  jarvis: boolean
  microphone: boolean
}

export type DesktopFrame = {width: number, height: number, jpeg: string}

export type Selection = {
  revision: string
  characters: number
  excerpt: string
  actions: string[]
}

export class SpatialBridge {
  private internet = require("LensStudio:InternetModule") as InternetModule

  constructor(private readonly endpoint: string, private readonly token: string) {}

  async request<T>(path: string, body?: object): Promise<T> {
    if (!this.token) throw new Error("Set the local pairing token in the Spatial component.")
    const headers = {Authorization: "Bearer " + this.token}
    const options = body
      ? {method: "POST", headers: {...headers, "Content-Type": "application/json"}, body: JSON.stringify(body), redirect: "error"}
      : {method: "GET", headers, redirect: "error"}
    const request = new Request(this.endpoint + path, options)
    const response = await this.internet.fetch(request)
    const text = await response.text()
    let data: {error?: string}
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error("Companion HTTP " + response.status + " returned an unreadable response.")
    }
    if (response.status !== 200) throw new Error(data.error || "Companion HTTP " + response.status)
    return data as T
  }
}
