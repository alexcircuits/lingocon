// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { __resetRateLimits } from "@/lib/rate-limit"
import { MODULE_RATE_LIMITS, MODULE_RATE_LIMIT_MESSAGE } from "@/lib/modules/rate-limits"

const { mockPrisma, mockGetUserId } = vi.hoisted(() => {
  const mockPrisma: Record<string, any> = {
    module: { findUnique: vi.fn(), update: vi.fn() },
    moduleVersion: { findFirst: vi.fn() },
    moduleInstall: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    moduleReview: { findUnique: vi.fn(), upsert: vi.fn() },
    moduleReport: { create: vi.fn() },
    language: { findMany: vi.fn() },
  }
  mockPrisma.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(mockPrisma) : Promise.all(arg as unknown[])
  )
  return { mockPrisma, mockGetUserId: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth-helpers", () => ({ getUserId: mockGetUserId, canEditScope: vi.fn(async () => true) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/utils/activity", () => ({ createActivity: vi.fn() }))
vi.mock("@/lib/admin", () => ({ isAdmin: vi.fn(async () => false) }))
vi.mock("@/lib/admin-audit", () => ({ logAdminAction: vi.fn() }))
vi.mock("@/lib/services/lemma-rewrite", () => ({ applyLemmaRewrites: vi.fn() }))

import { addModule, reviewModule, reportModule } from "../module"

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  __resetRateLimits()
  mockGetUserId.mockResolvedValue("user-1")
  mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", slug: "mod", status: "PUBLISHED" })
  mockPrisma.module.update.mockResolvedValue({ ratingSum: 5, ratingCount: 1 })
  mockPrisma.moduleVersion.findFirst.mockResolvedValue({ id: "v1" })
  mockPrisma.moduleInstall.findFirst.mockResolvedValue(null)
  mockPrisma.moduleReview.findUnique.mockResolvedValue(null)
  mockPrisma.language.findMany.mockResolvedValue([])
})

async function exhaust(call: () => Promise<unknown>, times: number) {
  for (let i = 0; i < times; i++) expect(await call()).toEqual({ success: true })
}

describe("module action rate limits (#31)", () => {
  it("reportModule: allows the budget, then returns an actionable error without writing", async () => {
    const report = () => reportModule({ moduleId: "m1", reason: "Shows spam in the reader" })
    await exhaust(report, MODULE_RATE_LIMITS.report.limit)
    expect(await report()).toEqual({ error: MODULE_RATE_LIMIT_MESSAGE })
    expect(mockPrisma.moduleReport.create).toHaveBeenCalledTimes(MODULE_RATE_LIMITS.report.limit)
  })

  it("reviewModule: blocks review bombing past the hourly budget", async () => {
    const review = () => reviewModule({ moduleId: "m1", rating: 1 })
    await exhaust(review, MODULE_RATE_LIMITS.review.limit)
    expect(await review()).toEqual({ error: MODULE_RATE_LIMIT_MESSAGE })
    expect(mockPrisma.moduleReview.upsert).toHaveBeenCalledTimes(MODULE_RATE_LIMITS.review.limit)
  })

  it("addModule: blocks install spam past the hourly budget", async () => {
    const add = () => addModule({ moduleId: "m1" })
    await exhaust(add, MODULE_RATE_LIMITS.add.limit)
    expect(await add()).toEqual({ error: MODULE_RATE_LIMIT_MESSAGE })
    expect(mockPrisma.moduleInstall.create).toHaveBeenCalledTimes(MODULE_RATE_LIMITS.add.limit)
  })

  it("keys budgets by user, so one user's spam doesn't block another", async () => {
    const report = () => reportModule({ moduleId: "m1", reason: "Shows spam in the reader" })
    await exhaust(report, MODULE_RATE_LIMITS.report.limit)
    mockGetUserId.mockResolvedValue("user-2")
    expect(await report()).toEqual({ success: true })
  })

  it("checks authentication before spending any budget", async () => {
    mockGetUserId.mockResolvedValue(null)
    expect(await reportModule({ moduleId: "m1", reason: "Shows spam in the reader" })).toEqual({
      error: "Unauthorized",
    })
  })
})
