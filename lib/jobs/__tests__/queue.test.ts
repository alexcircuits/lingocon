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

import { enqueueJob, claimNextJob, completeJob, failJob, MAX_ATTEMPTS, RETRY_BACKOFF_MS } from "@/lib/jobs/queue"

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
    const job = { id: "j1", type: "heartbeat", payload: {}, attempts: 0 }
    mockPrisma.job.findFirst.mockResolvedValueOnce(job)
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 })
    const claimed = await claimNextJob()
    expect(claimed).toEqual(job)
    const where = mockPrisma.job.updateMany.mock.calls[0][0].where
    expect(where).toEqual({ id: "j1", startedAt: null })
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
    mockPrisma.job.findFirst.mockResolvedValueOnce(null)
    await claimNextJob()
    const where = mockPrisma.job.findFirst.mock.calls[0][0].where
    expect(where.attempts).toEqual({ lt: MAX_ATTEMPTS })
    expect(where.startedAt).toBeNull()
  })
})

describe("completeJob", () => {
  it("stamps finishedAt and clears any previous error", async () => {
    await completeJob("j1")
    const arg = mockPrisma.job.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: "j1" })
    expect(arg.data.finishedAt).toBeInstanceOf(Date)
    expect(arg.data.error).toBeNull()
  })
})

describe("failJob", () => {
  it("records the error, releases the claim, and backs off by attempts", async () => {
    const now = new Date("2026-07-03T12:00:00Z")
    mockPrisma.job.findUnique.mockResolvedValueOnce({ id: "j1", attempts: 2 })
    await failJob("j1", new Error("boom"), now)
    const arg = mockPrisma.job.update.mock.calls[0][0]
    expect(arg.data.error).toBe("boom")
    expect(arg.data.startedAt).toBeNull()
    expect(arg.data.runAfter).toEqual(new Date(now.getTime() + RETRY_BACKOFF_MS * 2))
  })

  it("stringifies non-Error throwables", async () => {
    mockPrisma.job.findUnique.mockResolvedValueOnce({ id: "j1", attempts: 1 })
    await failJob("j1", "string failure")
    expect(mockPrisma.job.update.mock.calls[0][0].data.error).toBe("string failure")
  })

  it("is a no-op when the job vanished", async () => {
    mockPrisma.job.findUnique.mockResolvedValueOnce(null)
    await failJob("gone", new Error("x"))
    expect(mockPrisma.job.update).not.toHaveBeenCalled()
  })
})
