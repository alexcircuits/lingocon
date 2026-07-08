import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(async () => []),
    league: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    leagueMember: { findMany: vi.fn(), createMany: vi.fn() },
    xPEvent: { groupBy: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: unknown) => unknown)(mockPrisma) : Promise.all(arg as unknown[]),
    ),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { runLeagueRollover } from "@/lib/services/league-service"

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(mockPrisma) : Promise.all(arg as unknown[]),
  )
  mockPrisma.leagueMember.findMany.mockResolvedValue([]) // nobody joined the new week yet
  mockPrisma.league.create.mockResolvedValue({ id: "new-league" })
})

const MONDAY_PRIOR = new Date("2026-07-06T00:00:00Z")
const MONDAY_NOW = new Date("2026-07-13T00:00:00Z")

describe("runLeagueRollover", () => {
  it("is a no-op when there are no finished brackets (idempotent re-run)", async () => {
    mockPrisma.league.findMany.mockResolvedValueOnce([])
    const n = await runLeagueRollover(MONDAY_NOW)
    expect(n).toBe(0)
    expect(mockPrisma.league.create).not.toHaveBeenCalled()
    expect(mockPrisma.leagueMember.createMany).not.toHaveBeenCalled()
  })

  it("promotes/demotes, seeds next week with skipDuplicates, and marks processedAt", async () => {
    mockPrisma.league.findMany.mockResolvedValueOnce([
      { id: "L1", tier: "Gold", weekStart: MONDAY_PRIOR, members: [{ userId: "u1" }, { userId: "u2" }] },
    ])
    // u1 active (promotes to Sapphire), u2 inactive 0-XP (demotes to Silver).
    mockPrisma.xPEvent.groupBy.mockResolvedValueOnce([
      { userId: "u1", _sum: { amount: 500 } },
      { userId: "u2", _sum: { amount: 0 } },
    ])

    const n = await runLeagueRollover(MONDAY_NOW)

    expect(n).toBe(1)
    // Advisory lock was taken.
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    // A Sapphire and a Silver bracket were created (one per resolved tier).
    const createdTiers = mockPrisma.league.create.mock.calls.map((c) => c[0].data.tier).sort()
    expect(createdTiers).toEqual(["Sapphire", "Silver"])
    // Every member insert is skipDuplicates so a racing join can't abort the batch.
    for (const call of mockPrisma.leagueMember.createMany.mock.calls) {
      expect(call[0].skipDuplicates).toBe(true)
    }
    // Old bracket marked processed.
    expect(mockPrisma.league.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["L1"] } }, data: { processedAt: MONDAY_NOW } }),
    )
  })

  it("skips users who already joined the new week", async () => {
    mockPrisma.league.findMany.mockResolvedValueOnce([
      { id: "L1", tier: "Gold", weekStart: MONDAY_PRIOR, members: [{ userId: "u1" }] },
    ])
    mockPrisma.xPEvent.groupBy.mockResolvedValueOnce([{ userId: "u1", _sum: { amount: 500 } }])
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([{ userId: "u1" }]) // already placed

    await runLeagueRollover(MONDAY_NOW)

    expect(mockPrisma.league.create).not.toHaveBeenCalled()
    // Still marks the old bracket processed so it isn't reprocessed.
    expect(mockPrisma.league.updateMany).toHaveBeenCalled()
  })
})
