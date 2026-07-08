// Compute a user's quest board from data already collected. No new tables:
// daily/monthly totals come straight from XPEvent, LessonCompletion, CardReview.

import { prisma } from "@/lib/prisma"
import { buildQuestBoard, type QuestMetrics, type QuestProgress } from "@/lib/quests"

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function getQuestBoard(userId: string, now: Date = new Date()): Promise<QuestProgress[]> {
  const dayStart = startOfUtcDay(now)
  const monthStart = startOfUtcMonth(now)

  const [dayXp, dayLessons, dayReviews, monthXp, monthActiveDays] = await Promise.all([
    prisma.xPEvent.aggregate({ _sum: { amount: true }, where: { userId, createdAt: { gte: dayStart } } }),
    prisma.lessonCompletion.count({ where: { userId, completedAt: { gte: dayStart } } }),
    prisma.cardReview.count({ where: { reviewedAt: { gte: dayStart }, card: { enrollment: { userId } } } }),
    prisma.xPEvent.aggregate({ _sum: { amount: true }, where: { userId, createdAt: { gte: monthStart } } }),
    // Distinct UTC days the user earned any XP this month.
    prisma.$queryRaw<{ days: bigint }[]>`
      SELECT count(DISTINCT date_trunc('day', "createdAt")) AS days
      FROM "xp_events"
      WHERE "userId" = ${userId} AND "createdAt" >= ${monthStart}
    `,
  ])

  const daily: QuestMetrics = {
    xp: dayXp._sum.amount ?? 0,
    lessons: dayLessons,
    reviews: dayReviews,
    activeDays: 0,
  }
  const monthly: QuestMetrics = {
    xp: monthXp._sum.amount ?? 0,
    lessons: 0,
    reviews: 0,
    activeDays: Number(monthActiveDays[0]?.days ?? 0),
  }

  return buildQuestBoard(daily, monthly)
}
