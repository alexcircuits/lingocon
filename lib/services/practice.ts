// Practice hub queries — extra study sessions built from data already collected
// (StudyCard FSRS state + CardReview history). No new schema.

import { prisma } from "@/lib/prisma"

export type PracticeMode = "weak" | "mistakes"

/** How far back a wrong answer still counts as a "mistake to redo". */
export const MISTAKE_WINDOW_DAYS = 21

const cardSelect = {
  id: true,
  cardType: true,
  front: true,
  back: true,
  state: true,
  reps: true,
} as const

export type PracticeCard = {
  id: string
  cardType: string
  front: string
  back: string
  state: string
  reps: number
}

function mistakeWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - MISTAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

/** Reorder fetched cards to match a desired id order (fetch loses ordering). */
export function orderCardsByIds<T extends { id: string }>(cards: T[], ids: string[]): T[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  return ids.map((id) => byId.get(id)).filter((c): c is T => c !== undefined)
}

/** "Weak" = studied cards with the lowest FSRS stability (least durable memory),
 *  tie-broken by most lapses. NEW/unseen cards are excluded. */
export async function getWeakCards(enrollmentId: string, limit: number): Promise<PracticeCard[]> {
  return prisma.studyCard.findMany({
    where: { enrollmentId, state: { not: "NEW" }, reps: { gt: 0 } },
    select: cardSelect,
    orderBy: [{ stability: "asc" }, { lapses: "desc" }],
    take: limit,
  })
}

/** Distinct cards answered AGAIN within the mistake window, most-recent first. */
export async function getMistakeCardIds(enrollmentId: string, limit: number): Promise<string[]> {
  const rows = await prisma.cardReview.findMany({
    where: {
      rating: "AGAIN",
      reviewedAt: { gte: mistakeWindowStart() },
      card: { enrollmentId },
    },
    orderBy: { reviewedAt: "desc" },
    distinct: ["cardId"],
    take: limit,
    select: { cardId: true },
  })
  return rows.map((r) => r.cardId)
}

export async function getMistakeCards(enrollmentId: string, limit: number): Promise<PracticeCard[]> {
  const ids = await getMistakeCardIds(enrollmentId, limit)
  if (ids.length === 0) return []
  const cards = await prisma.studyCard.findMany({ where: { id: { in: ids } }, select: cardSelect })
  return orderCardsByIds(cards, ids)
}

export async function getPracticeCards(
  enrollmentId: string,
  mode: PracticeMode,
  limit: number,
): Promise<PracticeCard[]> {
  return mode === "weak" ? getWeakCards(enrollmentId, limit) : getMistakeCards(enrollmentId, limit)
}

/** Counts for the hub landing view. */
export async function getPracticeCounts(enrollmentId: string): Promise<{ weak: number; mistakes: number }> {
  const [weak, mistakeRows] = await Promise.all([
    prisma.studyCard.count({ where: { enrollmentId, state: { not: "NEW" }, reps: { gt: 0 } } }),
    prisma.cardReview.findMany({
      where: {
        rating: "AGAIN",
        reviewedAt: { gte: mistakeWindowStart() },
        card: { enrollmentId },
      },
      distinct: ["cardId"],
      select: { cardId: true },
    }),
  ])
  return { weak, mistakes: mistakeRows.length }
}
