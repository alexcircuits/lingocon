/**
 * Dependency-free URL checks, safe to import from client components. (The zod schemas in
 * `lib/validations/url.ts` build on these; importing those from a client component ships zod.)
 */

/** True for absolute http(s) URLs. `z.string().url()` also accepts `javascript:` and `data:`. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** True for an absolute http(s) URL or an in-app path like "/learn" (not protocol-relative "//host"). */
export function isSafeHttpUrlOrPath(value: string): boolean {
  return isSafeHttpUrl(value) || (value.startsWith("/") && !value.startsWith("//"))
}
