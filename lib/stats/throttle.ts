/**
 * Per-process limits on what the statistics write, so the public beacon cannot turn traffic into
 * unbounded database writes: repeated page views and over-eager pings are dropped, and past a
 * daily cap only presence ("online now") is kept. State is in memory, per PM2 process.
 */

const PAGEVIEW_DEDUPE_MS = 5_000
/** Below the 25 s client ping interval, so a normal ping always refreshes presence. */
const PRESENCE_REFRESH_MS = 15_000
/** Raw page views stored per process and UTC day; well above LingoCon's real traffic. */
export const DAILY_PAGEVIEW_CAP = 50_000
const MAX_TRACKED_VISITORS = 20_000
const FORGET_AFTER_MS = 60_000
const DAY_MS = 86_400_000

interface Seen {
  path: string
  viewAt: number
  presenceAt: number
}

const seen = new Map<string, Seen>()
let day = -1
let pageViewsToday = 0

export interface WritePlan {
  presence: boolean
  pageView: boolean
}

/** For tests. */
export function __resetThrottle(): void {
  seen.clear()
  day = -1
  pageViewsToday = 0
}

function forgetOldest(now: number): void {
  // Map keeps insertion order and every write re-inserts, so the oldest entries come first.
  for (const [key, entry] of seen) {
    if (seen.size <= MAX_TRACKED_VISITORS && now - entry.presenceAt < FORGET_AFTER_MS) break
    seen.delete(key)
  }
}

function remember(key: string, entry: Seen, now: number): void {
  seen.delete(key)
  seen.set(key, entry)
  if (seen.size > MAX_TRACKED_VISITORS) forgetOldest(now)
}

function underDailyCap(now: number): boolean {
  const today = Math.floor(now / DAY_MS)
  if (today !== day) {
    day = today
    pageViewsToday = 0
  }
  if (pageViewsToday < DAILY_PAGEVIEW_CAP) {
    pageViewsToday++
    return true
  }
  if (pageViewsToday === DAILY_PAGEVIEW_CAP) {
    pageViewsToday++ // warn once per day
    console.warn(`[stats] ${DAILY_PAGEVIEW_CAP} page views stored today by this process; storing presence only until midnight UTC`)
  }
  return false
}

/**
 * What to write for one hit by visitor `key` on `path` (the page's pathname; kept in this
 * process's memory for at most a minute, never stored) at `now` (ms).
 */
export function planWrite(type: "pageview" | "ping", key: string, path: string, now: number): WritePlan {
  const last = seen.get(key)
  const samePage = last?.path === path

  if (type === "ping") {
    if (samePage && now - last.presenceAt < PRESENCE_REFRESH_MS) return { presence: false, pageView: false }
    remember(key, { path, viewAt: last?.viewAt ?? 0, presenceAt: now }, now)
    return { presence: true, pageView: false }
  }

  if (samePage && now - last.viewAt < PAGEVIEW_DEDUPE_MS) return { presence: false, pageView: false }
  remember(key, { path, viewAt: now, presenceAt: now }, now)
  return { presence: true, pageView: underDailyCap(now) }
}
