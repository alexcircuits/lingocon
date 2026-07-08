import { describe, it, expect } from "vitest"
import {
  LEAGUE_TIERS,
  PROMOTE_COUNT,
  DEMOTE_COUNT,
  promotedTier,
  demotedTier,
  isTopTier,
  isBottomTier,
  assignCohorts,
  rankStandings,
  computeRollover,
  type Standing,
} from "@/lib/leagues"

describe("tier navigation", () => {
  it("promotes and demotes one step, capped at the ends", () => {
    expect(promotedTier("Bronze")).toBe("Silver")
    expect(demotedTier("Silver")).toBe("Bronze")
    expect(promotedTier("Diamond")).toBe("Diamond") // top is capped
    expect(demotedTier("Bronze")).toBe("Bronze") // bottom is capped
  })

  it("identifies the top and bottom tiers", () => {
    expect(isBottomTier("Bronze")).toBe(true)
    expect(isTopTier("Diamond")).toBe(true)
    expect(isTopTier(LEAGUE_TIERS[LEAGUE_TIERS.length - 1])).toBe(true)
    expect(isBottomTier("Gold")).toBe(false)
  })
})

describe("assignCohorts", () => {
  it("chunks members into brackets of at most `size`", () => {
    const members = Array.from({ length: 25 }, (_, i) => i)
    const cohorts = assignCohorts(members, 10)
    expect(cohorts.map((c) => c.length)).toEqual([10, 10, 5])
  })
})

describe("rankStandings", () => {
  it("ranks by weekly XP descending, breaking ties by input order", () => {
    const standings: Standing[] = [
      { userId: "a", weeklyXp: 100 },
      { userId: "b", weeklyXp: 300 },
      { userId: "c", weeklyXp: 100 },
    ]
    const ranked = rankStandings(standings)
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["a", 2], // tie with c, but appeared first
      ["c", 3],
    ])
  })
})

describe("computeRollover", () => {
  const standings = (xps: number[]): Standing[] =>
    xps.map((xp, i) => ({ userId: `u${i}`, weeklyXp: xp }))

  it("promotes the top N (with XP) and demotes the bottom N", () => {
    // 20 members, descending XP so rank order == input order.
    const xps = Array.from({ length: 20 }, (_, i) => 1000 - i * 10)
    const results = computeRollover(standings(xps), "Gold")
    const promoted = results.filter((r) => r.outcome === "promote")
    const demoted = results.filter((r) => r.outcome === "demote")
    expect(promoted).toHaveLength(PROMOTE_COUNT)
    expect(demoted).toHaveLength(DEMOTE_COUNT)
    expect(promoted.every((r) => r.nextTier === "Sapphire")).toBe(true)
    expect(demoted.every((r) => r.nextTier === "Silver")).toBe(true)
    // The middle stays.
    expect(results.filter((r) => r.outcome === "stay")).toHaveLength(20 - PROMOTE_COUNT - DEMOTE_COUNT)
  })

  it("never promotes out of the top tier (but can still demote)", () => {
    const results = computeRollover([{ userId: "a", weeklyXp: 500 }], "Diamond")
    expect(results.every((r) => r.outcome !== "promote")).toBe(true)
    // A lone active member at the top tier simply stays (not in the bottom zone
    // when they're the only one and have XP).
    expect(results[0].outcome).toBe("stay")
  })

  it("never demotes out of the bottom tier", () => {
    const results = computeRollover(standings([0, 0, 0]), "Bronze")
    expect(results.every((r) => r.outcome !== "demote")).toBe(true)
  })

  it("demotes an inactive (zero-XP) member in a small bracket that has no rank-demotion", () => {
    // 4 members (< PROMOTE_COUNT) so no rank-based demotion; only the 0-XP one demotes.
    const results = computeRollover(standings([100, 0, 80, 60]), "Gold")
    const zero = results.find((r) => r.userId === "u1")!
    expect(zero.outcome).toBe("demote")
    // The active members in this tiny bracket promote (small-bracket generosity).
    expect(results.filter((r) => r.outcome === "promote")).toHaveLength(3)
  })

  it("does not promote a zero-XP member sitting in a top slot of a tiny bracket", () => {
    const results = computeRollover(standings([0, 0]), "Gold")
    expect(results.every((r) => r.outcome !== "promote")).toBe(true)
  })
})
