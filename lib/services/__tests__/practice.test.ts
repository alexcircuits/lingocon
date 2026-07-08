import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    studyCard: { findMany: vi.fn(), count: vi.fn() },
    cardReview: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  orderCardsByIds,
  getWeakCards,
  getMistakeCards,
  getPracticeCounts,
} from "@/lib/services/practice"

beforeEach(() => vi.clearAllMocks())

describe("orderCardsByIds", () => {
  it("reorders cards to match the id order and drops missing ones", () => {
    const cards = [{ id: "b" }, { id: "a" }, { id: "c" }]
    expect(orderCardsByIds(cards, ["a", "c", "z", "b"]).map((c) => c.id)).toEqual(["a", "c", "b"])
  })
})

describe("getWeakCards", () => {
  it("orders by lowest stability then most lapses, excluding NEW cards", async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([])
    await getWeakCards("enr-1", 20)
    const arg = mockPrisma.studyCard.findMany.mock.calls[0][0]
    expect(arg.where).toMatchObject({ enrollmentId: "enr-1", state: { not: "NEW" }, reps: { gt: 0 } })
    expect(arg.orderBy).toEqual([{ stability: "asc" }, { lapses: "desc" }])
    expect(arg.take).toBe(20)
  })
})

describe("getMistakeCards", () => {
  it("queries recent AGAIN reviews and returns cards in recency order", async () => {
    mockPrisma.cardReview.findMany.mockResolvedValueOnce([{ cardId: "c2" }, { cardId: "c1" }])
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      { id: "c1", cardType: "VOCAB_RECOGNITION", front: "a", back: "b", state: "REVIEW", reps: 3 },
      { id: "c2", cardType: "VOCAB_RECOGNITION", front: "x", back: "y", state: "RELEARNING", reps: 1 },
    ])
    const cards = await getMistakeCards("enr-1", 10)

    const rw = mockPrisma.cardReview.findMany.mock.calls[0][0]
    expect(rw.where.rating).toBe("AGAIN")
    expect(rw.where.card).toEqual({ enrollmentId: "enr-1" })
    expect(rw.distinct).toEqual(["cardId"])
    // Recency order from the review query is preserved (c2 before c1).
    expect(cards.map((c) => c.id)).toEqual(["c2", "c1"])
  })

  it("short-circuits with no cards when there are no recent mistakes", async () => {
    mockPrisma.cardReview.findMany.mockResolvedValueOnce([])
    const cards = await getMistakeCards("enr-1", 10)
    expect(cards).toEqual([])
    expect(mockPrisma.studyCard.findMany).not.toHaveBeenCalled()
  })
})

describe("getPracticeCounts", () => {
  it("returns weak (studied) count and distinct mistake count", async () => {
    mockPrisma.studyCard.count.mockResolvedValueOnce(42)
    mockPrisma.cardReview.findMany.mockResolvedValueOnce([{ cardId: "a" }, { cardId: "b" }])
    const counts = await getPracticeCounts("enr-1")
    expect(counts).toEqual({ weak: 42, mistakes: 2 })
  })
})
