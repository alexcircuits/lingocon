import "server-only"
import type { z } from "zod"
import { readRustApiConfig } from "./config"

/** Extra fields for the failure log line (never secrets). */
type LogContext = Record<string, string | number | boolean>

const MAX_LOGGED_DETAIL = 200

function isDynamicUsageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  )
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return "request failed"
  const cause = (error as Error & { cause?: { code?: unknown } }).cause
  const code = typeof cause?.code === "string" ? ` ${cause.code}` : ""
  return `request failed (${error.name}${code})`
}

/** The service's `{"error": "..."}` message, if the body has one. */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return ` (${body.error.slice(0, MAX_LOGGED_DETAIL)})`
    }
  } catch {
    // Not JSON — the status code says enough.
  }
  return ""
}

/**
 * POSTs `body` to an internal endpoint and validates the JSON answer with `schema`.
 *
 * Returns `null` — so the caller can fall back to TypeScript — when the service is
 * not configured (without making a request), times out, fails, answers non-2xx or
 * returns an unexpected shape. Each failure is logged once, with context; the
 * token is never logged.
 */
export async function postInternal<T>(
  endpoint: `/v1/internal/${string}`,
  body: unknown,
  schema: z.ZodType<T>,
  context: LogContext = {}
): Promise<T | null> {
  const config = readRustApiConfig()
  if (!config) return null

  const fail = (reason: string): null => {
    console.error(`[rust-api] ${endpoint} failed: ${reason}`, context)
    return null
  }

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
      // Never replay the bearer token to wherever a redirect points.
      redirect: "error",
    })
  } catch (error) {
    // Next's patched fetch throws this during static generation to opt the route
    // into dynamic rendering; it must reach Next, not become a fallback.
    if (isDynamicUsageError(error)) throw error
    return fail(isTimeout(error) ? `timed out after ${config.timeoutMs} ms` : describeNetworkError(error))
  }

  if (!response.ok) {
    return fail(`HTTP ${response.status}${await errorDetail(response)}`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    return fail(isTimeout(error) ? `timed out after ${config.timeoutMs} ms` : "response is not valid JSON")
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return fail("response does not match the expected shape")
  }
  return parsed.data
}
