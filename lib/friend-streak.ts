// Friend streaks: a shared streak between two mutual follows that advances on
// each UTC day BOTH of them study. Pure transition logic (mirrors the daily
// streak in lib/streak.ts) so it's fully unit-tested; the service just persists.

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Whole UTC-day boundaries crossed from `from` to `to`. */
function utcDayDelta(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.round((b - a) / MS_PER_DAY)
}

export interface FriendStreakState {
  current: number
  longest: number
  /** Last UTC day on which BOTH friends studied. */
  lastBothDay: Date | null
}

/**
 * Advance a shared streak because both friends have now studied on `today`.
 * Idempotent within a day (a second call the same day is a no-op). A gap of more
 * than one day resets the streak to a fresh 1.
 */
export function advanceFriendStreak(state: FriendStreakState, today: Date): FriendStreakState {
  if (!state.lastBothDay) {
    return { current: 1, longest: Math.max(state.longest, 1), lastBothDay: today }
  }
  const delta = utcDayDelta(state.lastBothDay, today)
  if (delta <= 0) return state // already counted today (or clock skew)
  if (delta === 1) {
    const current = state.current + 1
    return { current, longest: Math.max(state.longest, current), lastBothDay: today }
  }
  // Missed a day — start over.
  return { current: 1, longest: Math.max(state.longest, 1), lastBothDay: today }
}

/**
 * The streak to SHOW today: the stored value while it's still alive (both
 * studied today or yesterday), otherwise 0 — a broken streak reads as gone even
 * before the next both-study day formally resets it.
 */
export function displayFriendStreak(state: FriendStreakState, today: Date): number {
  if (!state.lastBothDay) return 0
  return utcDayDelta(state.lastBothDay, today) <= 1 ? state.current : 0
}
