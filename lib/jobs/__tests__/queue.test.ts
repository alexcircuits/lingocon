import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { enqueueJob, claimNextJob, completeJob, failJob, MAX_ATTEMPTS, RETRY_BACKOFF_MS, STALE_CLAIM_MS } from "@/lib/jobs/queue"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("enqueueJob", () => {
  it("creates a job due immediately by default", async () => {
    mockPrisma.job.create.mockResolvedValueOnce({ id: "j1" })
    await enqueueJob("heartbeat")
    const arg = mockPrisma.job.create.mock.calls[0][0]
    expect(arg.data.type).toBe("heartbeat")
    expect(arg.data.payload).toEqual({})
    expect(arg.data.runAfter).toBeInstanceOf(Date)
  })

  it("passes payload and a future runAfter through", async () => {
    mockPrisma.job.create.mockResolvedValueOnce({ id: "j2" })
    const later = new Date(Date.now() + 60_000)
    await enqueueJob("league_rollover", { week: "2026-07-06" }, { runAfter: later })
    const arg = mockPrisma.job.create.mock.calls[0][0]
    expect(arg.data.payload).toEqual({ week: "2026-07-06" })
    expect(arg.data.runAfter).toBe(later)
  })
})

describe("claimNextJob", () => {
  it("returns null when no job is due", async () => {
    mockPrisma.job.findFirst.mockResolvedValueOnce(null)
    expect(await claimNextJob()).toBeNull()
  })

  it("claims the oldest due job via a conditional update", async () => {
    const now = new Date("2026-07-03T12:00:00Z")
    const job = { id: "j1", type: "heartbeat", payload: {}, attempts: 0 }
    mockPrisma.job.findFirst.mockResolvedValueOnce(job)
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 })
    const claimed = await claimNextJob(now)
    expect(claimed).toMatchObject(job)
    // The claim stamps a fresh lease, returned so the worker can finalize it.
    expect(claimed?.leaseId).toEqual(expect.any(String))
    const call = mockPrisma.job.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({
      id: "j1",
      finishedAt: null,
      OR: [{ startedAt: null }, { startedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } }],
    })
    expect(call.data.leaseId).toBe(claimed?.leaseId)
  })

  it("reclaims a stale claim from a dead worker", async () => {
    const now = new Date("2026-07-03T12:00:00Z")
    const staleThreshold = new Date(now.getTime() - STALE_CLAIM_MS)
    const job = {
      id: "j1",
      type: "heartbeat",
      payload: {},
      attempts: 1,
      startedAt: new Date(now.getTime() - STALE_CLAIM_MS - 60_000),
    }
    mockPrisma.job.findFirst.mockResolvedValueOnce(job)
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 })
    const claimed = await claimNextJob(now)
    expect(claimed).toMatchObject(job)
    const findWhere = mockPrisma.job.findFirst.mock.calls[0][0].where
    expect(findWhere.finishedAt).toBeNull()
    expect(findWhere.OR).toEqual([{ startedAt: null }, { startedAt: { lt: staleThreshold } }])
    const claimWhere = mockPrisma.job.updateMany.mock.calls[0][0].where
    expect(claimWhere.finishedAt).toBeNull()
    expect(claimWhere.OR).toEqual([{ startedAt: null }, { startedAt: { lt: staleThreshold } }])
  })

  it("returns null after exhausting claim retries", async () => {
    const job = { id: "j1", type: "heartbeat", payload: {}, attempts: 0 }
    mockPrisma.job.findFirst.mockResolvedValue(job)
    mockPrisma.job.updateMany.mockResolvedValue({ count: 0 })
    expect(await claimNextJob()).toBeNull()
    expect(mockPrisma.job.updateMany).toHaveBeenCalledTimes(5)
  })

  it("retries the next candidate when another worker won the race", async () => {
    const lost = { id: "j1", type: "a", payload: {}, attempts: 0 }
    const won = { id: "j2", type: "b", payload: {}, attempts: 0 }
    mockPrisma.job.findFirst.mockResolvedValueOnce(lost).mockResolvedValueOnce(won)
    mockPrisma.job.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    const claimed = await claimNextJob()
    expect(claimed?.id).toBe("j2")
  })

  it("only considers jobs with remaining attempts", async () => {
    const now = new Date("2026-07-03T12:00:00Z")
    mockPrisma.job.findFirst.mockResolvedValueOnce(null)
    await claimNextJob(now)
    const where = mockPrisma.job.findFirst.mock.calls[0][0].where
    expect(where.attempts).toEqual({ lt: MAX_ATTEMPTS })
    expect(where.finishedAt).toBeNull()
    expect(where.OR).toEqual([
      { startedAt: null },
      { startedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    ])
  })
})

describe("completeJob", () => {
  it("stamps finishedAt and clears the error ONLY while holding the lease", async () => {
    await completeJob("j1", "lease-1")
    const arg = mockPrisma.job.updateMany.mock.calls[0][0]
    // Fenced by leaseId: a reclaimer's new lease would make this match nothing.
    expect(arg.where).toEqual({ id: "j1", leaseId: "lease-1" })
    expect(arg.data.finishedAt).toBeInstanceOf(Date)
    expect(arg.data.error).toBeNull()
  })
})

describe("failJob", () => {
  it("records the error, releases the claim + lease, and backs off by attempts", async () => {
    const now = new Date("2026-07-03T12:00:00Z")
    mockPrisma.job.findUnique.mockResolvedValueOnce({ id: "j1", attempts: 2, leaseId: "lease-1" })
    await failJob("j1", "lease-1", new Error("boom"), now)
    const arg = mockPrisma.job.updateMany.mock.calls[0][0]
    expect(arg.where).toEqual({ id: "j1", leaseId: "lease-1" })
    expect(arg.data.error).toBe("boom")
    expect(arg.data.startedAt).toBeNull()
    expect(arg.data.leaseId).toBeNull()
    expect(arg.data.runAfter).toEqual(new Date(now.getTime() + RETRY_BACKOFF_MS * 2))
  })

  it("stringifies non-Error throwables", async () => {
    mockPrisma.job.findUnique.mockResolvedValueOnce({ id: "j1", attempts: 1, leaseId: "L" })
    await failJob("j1", "L", "string failure")
    expect(mockPrisma.job.updateMany.mock.calls[0][0].data.error).toBe("string failure")
  })

  it("truncates error messages to 2000 chars", async () => {
    mockPrisma.job.findUnique.mockResolvedValueOnce({ id: "j1", attempts: 1, leaseId: "L" })
    await failJob("j1", "L", new Error("x".repeat(3000)))
    expect(mockPrisma.job.updateMany.mock.calls[0][0].data.error).toHaveLength(2000)
  })

  it("is a no-op when the job vanished", async () => {
    mockPrisma.job.findUnique.mockResolvedValueOnce(null)
    await failJob("gone", "L", new Error("x"))
    expect(mockPrisma.job.updateMany).not.toHaveBeenCalled()
  })

  it("is a no-op when the lease was stolen by a reclaimer (fencing)", async () => {
    // The job now carries a different lease — a later worker reclaimed it.
    mockPrisma.job.findUnique.mockResolvedValueOnce({ id: "j1", attempts: 1, leaseId: "new-lease" })
    await failJob("j1", "old-lease", new Error("late"))
    expect(mockPrisma.job.updateMany).not.toHaveBeenCalled()
  })
})
