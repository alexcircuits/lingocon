import { describe, it, expect } from "vitest"
import {
  computeQuestProgress,
  buildQuestBoard,
  DAILY_QUESTS,
  MONTHLY_QUESTS,
  ALL_QUESTS,
  type QuestMetrics,
} from "@/lib/quests"

const xpQuest = DAILY_QUESTS.find((q) => q.id === "daily-xp")!

describe("computeQuestProgress", () => {
  it("reports partial progress with a capped percentage", () => {
    const p = computeQuestProgress(xpQuest, 30) // target 50
    expect(p).toMatchObject({ current: 30, complete: false, pct: 60 })
  })

  it("marks complete at or beyond target and caps pct at 100", () => {
    expect(computeQuestProgress(xpQuest, 50).complete).toBe(true)
    expect(computeQuestProgress(xpQuest, 999).pct).toBe(100)
  })

  it("clamps negative inputs to zero", () => {
    expect(computeQuestProgress(xpQuest, -5)).toMatchObject({ current: 0, pct: 0, complete: false })
  })
})

describe("buildQuestBoard", () => {
  const daily: QuestMetrics = { xp: 60, lessons: 1, reviews: 20, activeDays: 0 }
  const monthly: QuestMetrics = { xp: 400, lessons: 0, reviews: 0, activeDays: 22 }

  it("maps daily quests to daily metrics and monthly to monthly", () => {
    const board = buildQuestBoard(daily, monthly)
    expect(board).toHaveLength(ALL_QUESTS.length)

    const byId = Object.fromEntries(board.map((b) => [b.quest.id, b]))
    expect(byId["daily-xp"].complete).toBe(true) // 60 ≥ 50
    expect(byId["daily-lessons"].complete).toBe(false) // 1 < 3
    expect(byId["daily-reviews"].complete).toBe(true) // 20 ≥ 20
    expect(byId["monthly-xp"].complete).toBe(false) // 400 < 1000
    expect(byId["monthly-active"].complete).toBe(true) // 22 ≥ 20
  })

  it("does not cross daily and monthly metric sources", () => {
    // daily xp (60) must not satisfy the monthly xp quest (needs 1000).
    const board = buildQuestBoard({ xp: 60, lessons: 0, reviews: 0, activeDays: 0 }, { xp: 0, lessons: 0, reviews: 0, activeDays: 0 })
    expect(board.find((b) => b.quest.id === "monthly-xp")!.current).toBe(0)
  })

  it("covers every catalog quest exactly once", () => {
    const ids = buildQuestBoard(daily, monthly).map((b) => b.quest.id).sort()
    expect(ids).toEqual([...DAILY_QUESTS, ...MONTHLY_QUESTS].map((q) => q.id).sort())
  })
})
