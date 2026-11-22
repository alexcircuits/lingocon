/**
 * Keeps a failing or slow upstream from being called once per page view.
 *
 * Next's data cache does not store a rejected lookup and does not share an
 * in-flight one between requests, so during an outage (or on a cold cache)
 * every visitor would trigger their own call — enough to exhaust an anonymous
 * rate limit and turn a blip into a string of 429s.
 */

/** The last lookup failed recently; the upstream was not called again. */
export class LookupCoolingDownError extends Error {
  constructor() {
    super("Lookup skipped: the previous attempt failed and the retry cooldown has not passed")
    this.name = "LookupCoolingDownError"
  }
}

export interface GuardedLookupOptions {
  /** After a failure, how long to fail fast before trying the upstream again. */
  cooldownMs: number
  /** Injectable clock for tests. */
  now?: () => number
}

/**
 * Wraps `lookup` so that concurrent callers share one attempt, and so that
 * after a failure callers get a {@link LookupCoolingDownError} straight away
 * until `cooldownMs` has passed.
 *
 * The returned function holds the only mutable state (the in-flight promise and
 * the retry deadline); it is per process, which is all a rate-limit guard needs.
 */
export function createGuardedLookup<T>(
  lookup: () => Promise<T>,
  { cooldownMs, now = () => Date.now() }: GuardedLookupOptions,
): () => Promise<T> {
  let inFlight: Promise<T> | null = null
  let retryNotBefore = 0

  return () => {
    if (inFlight) return inFlight
    if (now() < retryNotBefore) return Promise.reject(new LookupCoolingDownError())

    const attempt = Promise.resolve()
      .then(lookup)
      .catch((error: unknown) => {
        retryNotBefore = now() + cooldownMs
        throw error
      })
      .finally(() => {
        inFlight = null
      })
    inFlight = attempt
    return attempt
  }
}
