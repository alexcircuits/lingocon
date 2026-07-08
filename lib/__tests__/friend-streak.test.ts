import { describe, it, expect } from "vitest"
import { advanceFriendStreak, displayFriendStreak, type FriendStreakState } from "@/lib/friend-streak"

const day = (iso: string) => new Date(`${iso}T12:00:00Z`)
const fresh = (): FriendStreakState => ({ current: 0, longest: 0, lastBothDay: null })

describe("advanceFriendStreak", () => {
  it("starts a streak at 1 the first day both study", () => {
    expect(advanceFriendStreak(fresh(), day("2026-07-01"))).toEqual({
      current: 1,
      longest: 1,
      lastBothDay: day("2026-07-01"),
    })
  })

  it("increments on consecutive days and tracks the longest", () => {
    let s = advanceFriendStreak(fresh(), day("2026-07-01"))
    s = advanceFriendStreak(s, day("2026-07-02"))
    s = advanceFriendStreak(s, day("2026-07-03"))
    expect(s.current).toBe(3)
    expect(s.longest).toBe(3)
  })

  it("is idempotent within the same day", () => {
    const s = advanceFriendStreak(fresh(), day("2026-07-01"))
    expect(advanceFriendStreak(s, day("2026-07-01"))).toEqual(s)
  })

  it("resets to 1 after a missed day but keeps the longest", () => {
    let s = advanceFriendStreak(fresh(), day("2026-07-01"))
    s = advanceFriendStreak(s, day("2026-07-02")) // current 2
    s = advanceFriendStreak(s, day("2026-07-05")) // gap → reset
    expect(s.current).toBe(1)
    expect(s.longest).toBe(2)
  })
})

describe("displayFriendStreak", () => {
  it("shows the stored value while alive (today or yesterday)", () => {
    const s: FriendStreakState = { current: 5, longest: 9, lastBothDay: day("2026-07-06") }
    expect(displayFriendStreak(s, day("2026-07-06"))).toBe(5) // today
    expect(displayFriendStreak(s, day("2026-07-07"))).toBe(5) // yesterday, still alive
  })

  it("reads as 0 once the streak has gone stale", () => {
    const s: FriendStreakState = { current: 5, longest: 9, lastBothDay: day("2026-07-06") }
    expect(displayFriendStreak(s, day("2026-07-08"))).toBe(0) // 2 days later
  })

  it("is 0 when never established", () => {
    expect(displayFriendStreak(fresh(), day("2026-07-01"))).toBe(0)
  })
})
