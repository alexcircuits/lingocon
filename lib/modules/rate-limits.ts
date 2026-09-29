import { rateLimit } from "@/lib/rate-limit"

/**
 * Abuse limits for the module surfaces (GitHub #31). Documented in docs/MODULES_MARKETPLACE.md §9.
 *
 * Generous enough that normal use never hits them: a reader page with a widget makes a handful of
 * data calls per load. They exist to stop bulk lexicon scraping through public reader widgets,
 * install spam, review bombing and report spam. The limiter is per process (see lib/rate-limit.ts).
 */
export const MODULE_RATE_LIMITS = {
  /** Per caller (user, else IP) per language per module. */
  data: { limit: 60, windowMs: 60_000 },
  /** Per caller across all languages and modules, so scraping can't fan out over many languages. */
  dataCaller: { limit: 300, windowMs: 60_000 },
  /** Per user; the playground only reads the caller's own languages. */
  playground: { limit: 120, windowMs: 60_000 },
  add: { limit: 20, windowMs: 60 * 60_000 },
  review: { limit: 10, windowMs: 60 * 60_000 },
  report: { limit: 5, windowMs: 60 * 60_000 },
} as const

export type ModuleRateLimitKind = keyof typeof MODULE_RATE_LIMITS

export const MODULE_RATE_LIMIT_MESSAGE = "Too many requests. Please wait a bit and try again."

/**
 * Records a hit for `kind` + `key` and returns how long the caller must wait, or 0 when allowed.
 * Hits are logged at warn level so admins can spot abuse; the key holds ids/IPs only.
 */
export function moduleRateLimitRetryAfterMs(kind: ModuleRateLimitKind, key: string): number {
  const { limit, windowMs } = MODULE_RATE_LIMITS[kind]
  const result = rateLimit(`module-${kind}:${key}`, limit, windowMs)
  if (result.ok) return 0
  console.warn(`[modules] rate limit hit: ${kind} ${key}`)
  return Math.max(result.retryAfterMs, 1)
}
