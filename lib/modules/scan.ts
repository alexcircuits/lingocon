/**
 * Best-effort static scan for author-submitted sandbox bundles.
 *
 * The primary defense is runtime isolation: bundles run in a
 * `sandbox="allow-scripts"` iframe (null origin) under a strict CSP that blocks
 * ALL network access (see `buildSandboxDocFromCode`). This scan is a
 * defense-in-depth gate at publish time that rejects code which obviously tries
 * to break out or exfiltrate, and keeps bundles to a sane size.
 */

export const MAX_BUNDLE_BYTES = 100_000

/** Patterns that have no legitimate use inside a sandboxed widget. */
const DENYLIST: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bdocument\s*\.\s*cookie\b/, reason: "document.cookie is not allowed" },
  { pattern: /\b(local|session)Storage\b/, reason: "Web Storage is not allowed" },
  { pattern: /\bindexedDB\b/, reason: "indexedDB is not allowed" },
  { pattern: /\bXMLHttpRequest\b/, reason: "XMLHttpRequest is not allowed" },
  { pattern: /\bWebSocket\b/, reason: "WebSocket is not allowed" },
  { pattern: /\bEventSource\b/, reason: "EventSource is not allowed" },
  { pattern: /\bnavigator\s*\.\s*sendBeacon\b/, reason: "sendBeacon is not allowed" },
  { pattern: /\bfetch\s*\(/, reason: "Direct fetch is blocked — use host.request() instead" },
  { pattern: /\beval\s*\(/, reason: "eval is not allowed" },
  { pattern: /new\s+Function\b/, reason: "Function constructor is not allowed" },
  { pattern: /\bimport\s*\(/, reason: "Dynamic import is not allowed" },
  { pattern: /\bimportScripts\b/, reason: "importScripts is not allowed" },
  { pattern: /\bdocument\s*\.\s*domain\b/, reason: "document.domain is not allowed" },
  { pattern: /\bwindow\s*\.\s*top\b/, reason: "window.top access is not allowed" },
  { pattern: /\bwindow\s*\.\s*opener\b/, reason: "window.opener access is not allowed" },
  { pattern: /<\/script\s*>/i, reason: "Closing </script> tags are not allowed in bundle code" },
]

export type ScanResult = { ok: true } | { ok: false; reason: string }

export function scanBundle(code: string): ScanResult {
  if (typeof code !== "string" || code.trim().length === 0) {
    return { ok: false, reason: "Bundle code is empty" }
  }
  const bytes = new TextEncoder().encode(code).length
  if (bytes > MAX_BUNDLE_BYTES) {
    return { ok: false, reason: `Bundle exceeds ${Math.round(MAX_BUNDLE_BYTES / 1000)} KB` }
  }
  for (const { pattern, reason } of DENYLIST) {
    if (pattern.test(code)) return { ok: false, reason }
  }
  return { ok: true }
}
