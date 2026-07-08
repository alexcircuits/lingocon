// Lightweight fixed-window rate limiter, in-process (no Redis/deps).
//
// CAVEAT: state lives in the Node process, so with N PM2 cluster instances the
// effective limit is ~N× per user and it resets on restart. That's fine for its
// job here — blunting abuse of expensive endpoints (bulk find/replace, uploads)
// — but a shared store (Redis/Upstash) would be the move for hard multi-tenant
// quotas. Keep limits generous enough that the cluster factor doesn't bite real
// users.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number
}

/**
 * Record a hit against `key` and report whether it's within `limit` per
 * `windowMs`. `now` is injectable for tests.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  // Cheap opportunistic prune so the map can't grow unbounded across many keys.
  if (buckets.size > 5000 && Math.random() < 0.02) pruneRateLimits(now)

  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now }
  }
  b.count += 1
  return { ok: true, remaining: limit - b.count, retryAfterMs: 0 }
}

/** Drop expired windows. */
export function pruneRateLimits(now: number = Date.now()): void {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k)
  }
}

/** Test hook. */
export function __resetRateLimits(): void {
  buckets.clear()
}
