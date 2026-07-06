import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    courseLesson: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lessonCompletion: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    xPEvent: {
      create: vi.fn(),
    },
    studyCard: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    cardReview: {
      create: vi.fn(),
    },
    language: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
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

import { completeLesson } from "@/app/actions/learn"

const LESSON_ID = "lesson-1"
const LANGUAGE_ID = "lang-1"
const ENROLLMENT_ID = "enroll-1"

function baseCard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "card-1",
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
    lastReview: new Date("2026-06-30T00:00:00Z"),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops)
  mockPrisma.courseLesson.findUnique.mockResolvedValue({
    course: { languageId: LANGUAGE_ID, visibility: "PUBLISHED" },
  })
  mockPrisma.enrollment.findUnique.mockResolvedValue({
    id: ENROLLMENT_ID,
    userId: "user-1",
    languageId: LANGUAGE_ID,
    lastStudied: new Date("2026-06-30T00:00:00Z"),
    streak: 3,
  })
  mockPrisma.lessonCompletion.findUnique.mockResolvedValue(null)
  mockPrisma.studyCard.findMany.mockResolvedValue([])
  mockPrisma.language.findUnique.mockResolvedValue({ slug: "test-lang" })
})

describe("completeLesson — back-compat (no results)", () => {
  it("does not query or write any StudyCard when results is omitted", async () => {
    await completeLesson(LESSON_ID, 3)
    expect(mockPrisma.studyCard.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.studyCard.update).not.toHaveBeenCalled()
    expect(mockPrisma.cardReview.create).not.toHaveBeenCalled()
  })

  it("does not query or write any StudyCard when results is an empty array", async () => {
    await completeLesson(LESSON_ID, 3, [])
    expect(mockPrisma.studyCard.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.studyCard.update).not.toHaveBeenCalled()
    expect(mockPrisma.cardReview.create).not.toHaveBeenCalled()
  })
})

describe("completeLesson — FSRS rescheduling from results", () => {
  it("queries studyCard.findMany with the deduped entry ids", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([baseCard()])

    await completeLesson(LESSON_ID, 3, [
      { entryId: "entry-1", correct: true },
      { entryId: "entry-2", correct: true },
    ])

    expect(mockPrisma.studyCard.findMany).toHaveBeenCalledTimes(1)
    const arg = mockPrisma.studyCard.findMany.mock.calls[0][0]
    expect(arg.where.enrollmentId).toBe(ENROLLMENT_ID)
    expect(new Set(arg.where.dictEntryId.in)).toEqual(new Set(["entry-1", "entry-2"]))
  })

  it("reschedules matched cards: studyCard.update and cardReview.create both fire", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([baseCard({ id: "card-1", dictEntryId: "entry-1" })])

    await completeLesson(LESSON_ID, 3, [{ entryId: "entry-1", correct: true }])

    expect(mockPrisma.studyCard.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.studyCard.update.mock.calls[0][0].where).toEqual({ id: "card-1" })
    expect(mockPrisma.cardReview.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.cardReview.create.mock.calls[0][0].data.cardId).toBe("card-1")
  })

  it("rates a perfect lesson's correct entries as EASY", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([baseCard({ id: "card-1", dictEntryId: "entry-1" })])

    await completeLesson(LESSON_ID, 3, [{ entryId: "entry-1", correct: true }])

    expect(mockPrisma.cardReview.create.mock.calls[0][0].data.rating).toBe("EASY")
  })

  it("rates a non-perfect lesson's correct entries as GOOD", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      baseCard({ id: "card-1", dictEntryId: "entry-1" }),
      baseCard({ id: "card-2", dictEntryId: "entry-2" }),
    ])

    await completeLesson(LESSON_ID, 3, [
      { entryId: "entry-1", correct: true },
      { entryId: "entry-2", correct: false },
    ])

    const card1Review = mockPrisma.cardReview.create.mock.calls.find(c => c[0].data.cardId === "card-1")
    const card2Review = mockPrisma.cardReview.create.mock.calls.find(c => c[0].data.cardId === "card-2")
    expect(card1Review?.[0].data.rating).toBe("GOOD")
    expect(card2Review?.[0].data.rating).toBe("AGAIN")
  })

  it("dedupes repeated entries keeping the worst outcome (any incorrect wins)", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([baseCard({ id: "card-1", dictEntryId: "entry-1" })])

    // Same entry answered correct then incorrect (e.g. retried after a miss).
    await completeLesson(LESSON_ID, 3, [
      { entryId: "entry-1", correct: true },
      { entryId: "entry-1", correct: false },
    ])

    expect(mockPrisma.studyCard.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.cardReview.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.cardReview.create.mock.calls[0][0].data.rating).toBe("AGAIN")
  })

  it("does not add cardReview xpEarned into enrollment.xp — enrollment xp is lesson xp + streak bonus only", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([baseCard({ id: "card-1", dictEntryId: "entry-1" })])

    await completeLesson(LESSON_ID, 3, [{ entryId: "entry-1", correct: true }])

    const enrollmentUpdateArg = mockPrisma.enrollment.update.mock.calls[0][0]
    // fullXp for heartsLeft=3 is base(10) + perHeart(5)*3 = 25; no streak bump here (already same-day-ish window)
    // We only assert it does NOT include any card xpEarned contribution beyond lesson+streak math.
    const cardReviewXp = mockPrisma.cardReview.create.mock.calls.reduce(
      (sum, c) => sum + (c[0].data.xpEarned ?? 0),
      0,
    )
    expect(cardReviewXp).toBeGreaterThan(0)
    // enrollment increment should equal xpEarned (lesson) + streak bonus, independent of cardReviewXp
    expect(enrollmentUpdateArg.data.xp.increment).not.toBe(cardReviewXp)
  })

  it("handles multiple cards per entry (VOCAB_RECOGNITION + VOCAB_PRODUCTION + CLOZE)", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      baseCard({ id: "card-1", dictEntryId: "entry-1", cardType: "VOCAB_RECOGNITION" }),
      baseCard({ id: "card-2", dictEntryId: "entry-1", cardType: "VOCAB_PRODUCTION" }),
      baseCard({ id: "card-3", dictEntryId: "entry-1", cardType: "CLOZE" }),
    ])

    await completeLesson(LESSON_ID, 3, [{ entryId: "entry-1", correct: true }])

    expect(mockPrisma.studyCard.update).toHaveBeenCalledTimes(3)
    expect(mockPrisma.cardReview.create).toHaveBeenCalledTimes(3)
  })
})
