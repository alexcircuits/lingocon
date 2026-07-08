import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    studyCard: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    cardReview: { create: vi.fn() },
    enrollment: { findUnique: vi.fn(), update: vi.fn() },
    xPEvent: { create: vi.fn() },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => unknown)(mockPrisma)
        : Promise.all(arg as unknown[]),
    ),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: vi.fn(async () => "user-1"),
  getUserId: vi.fn(async () => "user-1"),
  canEditLanguage: vi.fn(async () => true),
  canViewLanguage: vi.fn(async () => true),
}))
vi.mock("@/app/actions/badge", () => ({
  checkLearnerBadges: vi.fn(async () => undefined),
}))

import { submitReview } from "@/app/actions/learn"

function baseCard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "card-1",
    enrollmentId: "enroll-1",
    dictEntryId: "entry-1",
    cardType: "VOCAB_RECOGNITION",
    due: new Date("2026-07-01T00:00:00Z"),
    stability: 2,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    reps: 1,
    lapses: 0,
    state: "REVIEW",
    // Old enough that the 2-second anti-double-submit guard does not trip.
    lastReview: new Date("2026-06-30T00:00:00Z"),
    enrollment: {
      id: "enroll-1",
      userId: "user-1",
      languageId: "lang-1",
      lastStudied: new Date("2026-06-30T00:00:00Z"),
      streak: 3,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(mockPrisma)
      : Promise.all(arg as unknown[]),
  )
  mockPrisma.studyCard.findFirst.mockResolvedValue(baseCard())
  mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 })
  // In-tx streak read (after the FOR UPDATE lock).
  mockPrisma.enrollment.findUnique.mockResolvedValue({
    lastStudied: new Date("2026-06-30T00:00:00Z"),
    streak: 3,
  })
})

describe("submitReview — optimistic concurrency", () => {
  it("applies the review under a lastReview-guarded update and records it", async () => {
    const res = await submitReview("card-1", "GOOD", 3000)

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledTimes(1)
    const where = mockPrisma.studyCard.updateMany.mock.calls[0][0].where
    expect(where.id).toBe("card-1")
    // Guard token is the lastReview value read before the update.
    expect(where.lastReview).toEqual(new Date("2026-06-30T00:00:00Z"))
    expect(mockPrisma.cardReview.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.enrollment.update).toHaveBeenCalledTimes(1)
    expect(res.data?.xpEarned).toBeGreaterThanOrEqual(0)
  })

  it("loses the race gracefully when a concurrent review already advanced the card", async () => {
    mockPrisma.studyCard.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await submitReview("card-1", "GOOD", 3000)

    expect(res.error).toBe("Too soon")
    // No duplicate review row and no XP double-count when the guard fails.
    expect(mockPrisma.cardReview.create).not.toHaveBeenCalled()
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled()
  })

  it("rejects a rapid re-submit via the 2-second guard before opening a transaction", async () => {
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce(baseCard({ lastReview: new Date() }))

    const res = await submitReview("card-1", "GOOD", 500)

    expect(res.error).toBe("Too soon")
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.studyCard.updateMany).not.toHaveBeenCalled()
  })

  it("returns 'Card not found' when the card doesn't belong to the user", async () => {
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce(null)

    const res = await submitReview("nope", "GOOD", 3000)

    expect(res.error).toBe("Card not found")
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
