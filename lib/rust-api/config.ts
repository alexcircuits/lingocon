import "server-only"

/**
 * Connection settings for the Rust platform service (`rust/crates/api`).
 *
 * The service is optional: with LINGOCON_API_URL / LINGOCON_API_TOKEN unset the
 * callers fall back to the TypeScript implementation, which is also how a deploy
 * is rolled back (unset LINGOCON_API_URL and reload).
 */
export interface RustApiConfig {
  /** Origin without a trailing slash, e.g. `http://127.0.0.1:3040`. */
  baseUrl: string
  token: string
  timeoutMs: number
}

type EnvSource = Record<string, string | undefined>

export const DEFAULT_TIMEOUT_MS = 3_000
const MAX_TIMEOUT_MS = 60_000
const FALLBACK = "using the TypeScript fallback"

const warned = new Set<string>()

/** Misconfiguration is reported once per process, not on every request. */
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[rust-api] ${message}`)
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TIMEOUT_MS
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > MAX_TIMEOUT_MS) {
    warnOnce(
      "timeout",
      `LINGOCON_API_TIMEOUT_MS must be an integer from 1 to ${MAX_TIMEOUT_MS}; using ${DEFAULT_TIMEOUT_MS}`
    )
    return DEFAULT_TIMEOUT_MS
  }
  return value
}

/** `null` when the service is not (or not correctly) configured. Never logs the token. */
export function readRustApiConfig(env: EnvSource = process.env): RustApiConfig | null {
  const url = env.LINGOCON_API_URL?.trim() ?? ""
  const token = env.LINGOCON_API_TOKEN?.trim() ?? ""
  if (!url && !token) return null
  if (!url || !token) {
    warnOnce("partial", `LINGOCON_API_URL and LINGOCON_API_TOKEN must both be set; ${FALLBACK}`)
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    warnOnce("url", `LINGOCON_API_URL is not a valid URL; ${FALLBACK}`)
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    warnOnce("protocol", `LINGOCON_API_URL must be an http(s) URL; ${FALLBACK}`)
    return null
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    warnOnce("shape", `LINGOCON_API_URL must not contain credentials, a query or a fragment; ${FALLBACK}`)
    return null
  }
  return {
    baseUrl: `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`,
    token,
    timeoutMs: parseTimeout(env.LINGOCON_API_TIMEOUT_MS),
  }
}
