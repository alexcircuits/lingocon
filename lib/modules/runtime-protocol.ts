/**
 * Phase 2 sandbox runtime — host ↔ module message protocol.
 *
 * Modules run inside a `sandbox="allow-scripts"` iframe (null origin, no DOM /
 * cookie / network / DB access). The ONLY way a module touches platform data is
 * by asking the host via `postMessage`. The host validates every request
 * against the permissions the installer granted before answering.
 *
 * This file is UI-safe (no server imports) so both the client `ModuleFrame`
 * and the data route can share the method→permission contract.
 */

/** Data methods a module can call, mapped to the permission they require. */
export const RUNTIME_METHODS = {
  getLanguage: null, // public metadata, no permission
  getDictionary: "read:dictionary",
  getPhonology: "read:phonology",
  getParadigms: "read:paradigms",
  getGrammar: "read:grammar",
  getTexts: "read:texts",
} as const

export type RuntimeMethod = keyof typeof RUNTIME_METHODS

export function isRuntimeMethod(value: unknown): value is RuntimeMethod {
  return typeof value === "string" && value in RUNTIME_METHODS
}

/** Permission required for a method, or null if it's freely available. */
export function permissionForMethod(method: RuntimeMethod): string | null {
  return RUNTIME_METHODS[method]
}

// ── Message envelopes ──────────────────────────────────────────────────────
// host → module
export type HostInitMessage = {
  source: "lingocon-host"
  type: "init"
  context: {
    moduleId: string
    languageSlug: string
    languageId: string
    permissions: string[]
    theme: "light" | "dark"
  }
}
export type HostResponseMessage = {
  source: "lingocon-host"
  type: "response"
  id: number
  ok: boolean
  data?: unknown
  error?: string
}
export type HostMessage = HostInitMessage | HostResponseMessage

// module → host
export type WidgetReadyMessage = { source: "lingocon-module"; type: "ready" }
export type WidgetRequestMessage = {
  source: "lingocon-module"
  type: "request"
  id: number
  method: string
  params?: unknown
}
export type WidgetResizeMessage = {
  source: "lingocon-module"
  type: "resize"
  height: number
}
export type WidgetErrorMessage = {
  source: "lingocon-module"
  type: "error"
  message: string
}
export type WidgetDownloadMessage = {
  source: "lingocon-module"
  type: "download"
  filename: string
  mime: string
  content: string
}
export type WidgetMessage =
  | WidgetReadyMessage
  | WidgetRequestMessage
  | WidgetResizeMessage
  | WidgetErrorMessage
  | WidgetDownloadMessage

export function isWidgetMessage(value: unknown): value is WidgetMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "lingocon-module" &&
    typeof (value as { type?: unknown }).type === "string"
  )
}
