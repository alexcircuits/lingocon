// Daily / monthly quests. Progress is COMPUTED from data already collected
// (XPEvent, LessonCompletion, CardReview), so there are no counters to keep in
// sync and no new schema — the catalog and math here are pure and unit-tested.

export type QuestPeriod = "daily" | "monthly"
export type QuestMetricKey = "xp" | "lessons" | "reviews" | "activeDays"

export interface QuestDef {
  id: string
  period: QuestPeriod
  metric: QuestMetricKey
  target: number
  title: string
  description: string
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: "daily-xp", period: "daily", metric: "xp", target: 50, title: "Earn 50 XP", description: "Rack up 50 XP today." },
  { id: "daily-lessons", period: "daily", metric: "lessons", target: 3, title: "Finish 3 lessons", description: "Complete three lessons today." },
  { id: "daily-reviews", period: "daily", metric: "reviews", target: 20, title: "Do 20 reviews", description: "Review twenty cards today." },
]

export const MONTHLY_QUESTS: QuestDef[] = [
  { id: "monthly-xp", period: "monthly", metric: "xp", target: 1000, title: "Earn 1,000 XP", description: "Reach 1,000 XP this month." },
  { id: "monthly-active", period: "monthly", metric: "activeDays", target: 20, title: "Study 20 days", description: "Practice on twenty days this month." },
]

export const ALL_QUESTS: QuestDef[] = [...DAILY_QUESTS, ...MONTHLY_QUESTS]

/** Per-period metric totals for one user. */
export interface QuestMetrics {
  xp: number
  lessons: number
  reviews: number
  activeDays: number
}

export interface QuestProgress {
  quest: QuestDef
  current: number
  complete: boolean
  /** Capped 0–100 for a progress bar. */
  pct: number
}

export function computeQuestProgress(quest: QuestDef, current: number): QuestProgress {
  const safeCurrent = Math.max(0, current)
  const capped = Math.min(safeCurrent, quest.target)
  return {
    quest,
    current: safeCurrent,
    complete: safeCurrent >= quest.target,
    pct: quest.target > 0 ? Math.round((capped / quest.target) * 100) : 0,
  }
}

/** Map the daily/monthly metric totals onto the quest catalog. */
export function buildQuestBoard(daily: QuestMetrics, monthly: QuestMetrics): QuestProgress[] {
  return ALL_QUESTS.map((q) => {
    const source = q.period === "daily" ? daily : monthly
    return computeQuestProgress(q, source[q.metric])
  })
}
