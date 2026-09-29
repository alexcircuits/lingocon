// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import { __resetRateLimits } from "@/lib/rate-limit"
import { MODULE_RATE_LIMITS } from "@/lib/modules/rate-limits"

const { mockPrisma, mockAuth, mockLoadModuleData } = vi.hoisted(() => ({
  mockPrisma: {
    language: { findUnique: vi.fn() },
    moduleInstall: { findFirst: vi.fn() },
  },
  mockAuth: {
    getUserId: vi.fn(),
    canViewLanguage: vi.fn(),
    canEditLanguage: vi.fn(),
    canEditScope: vi.fn(),
  },
  mockLoadModuleData: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth-helpers", () => mockAuth)
vi.mock("@/lib/modules/data", () => ({ loadModuleData: mockLoadModuleData }))

import { POST as dataPOST } from "../data/route"
import { POST as playgroundPOST } from "../playground/route"

const LANGUAGE = { id: "lang-1", ownerId: "owner-1" }

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/modules/data", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

function install(permissions: string[]) {
  return { grantedPermissions: permissions, version: { permissions } }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  __resetRateLimits()
  mockAuth.getUserId.mockResolvedValue(null)
  mockAuth.canViewLanguage.mockResolvedValue(true)
  mockAuth.canEditLanguage.mockResolvedValue(false)
  mockAuth.canEditScope.mockResolvedValue(true)
  mockPrisma.language.findUnique.mockResolvedValue(LANGUAGE)
  mockPrisma.moduleInstall.findFirst.mockResolvedValue(null)
  mockLoadModuleData.mockResolvedValue({ ok: true })
})

describe("POST /api/modules/data — permission gate", () => {
  it("rejects methods that aren't runtime methods, including inherited object keys", async () => {
    for (const method of ["deleteEverything", "constructor", "__proto__", "toString"]) {
      const res = await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method }))
      expect(res.status).toBe(400)
    }
    expect(mockLoadModuleData).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller cannot view the language", async () => {
    mockAuth.canViewLanguage.mockResolvedValue(false)
    const res = await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method: "getLanguage" }))
    expect(res.status).toBe(403)
    expect(mockLoadModuleData).not.toHaveBeenCalled()
  })

  it("serves getLanguage without any install or permission", async () => {
    const res = await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method: "getLanguage" }))
    expect(res.status).toBe(200)
    expect(mockPrisma.moduleInstall.findFirst).not.toHaveBeenCalled()
    expect(mockLoadModuleData).toHaveBeenCalledWith("getLanguage", "lang-1")
  })

  it("returns 403 when the owner's install doesn't grant the method's permission", async () => {
    mockPrisma.moduleInstall.findFirst.mockResolvedValue(install(["read:phonology"]))
    const res = await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method: "getDictionary" }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Permission "read:dictionary" not granted for this module' })
    expect(mockLoadModuleData).not.toHaveBeenCalled()
  })

  it("serves data when the owner's enabled, published install grants the permission", async () => {
    mockPrisma.moduleInstall.findFirst.mockResolvedValue(install(["read:dictionary"]))
    const res = await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method: "getDictionary" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { ok: true } })
    const where = mockPrisma.moduleInstall.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ moduleId: "m1", enabled: true, module: { status: "PUBLISHED" } })
    expect(where.userId).toEqual({ in: ["owner-1"] })
  })

  it("does not let a viewer's own install unlock a language they can only view (#32)", async () => {
    mockAuth.getUserId.mockResolvedValue("visitor-1")
    await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method: "getDictionary" }))
    expect(mockPrisma.moduleInstall.findFirst.mock.calls[0][0].where.userId).toEqual({ in: ["owner-1"] })

    mockAuth.canEditLanguage.mockResolvedValue(true)
    await dataPOST(request({ languageId: "lang-1", moduleId: "m1", method: "getDictionary" }))
    expect(mockPrisma.moduleInstall.findFirst.mock.calls[1][0].where.userId).toEqual({ in: ["owner-1", "visitor-1"] })
  })
})

describe("POST /api/modules/data — rate limits (#31)", () => {
  const { limit } = MODULE_RATE_LIMITS.data
  const body = { languageId: "lang-1", moduleId: "m1", method: "getLanguage" }

  it("leaves normal widget usage alone and returns 429 with Retry-After past the limit", async () => {
    for (let i = 0; i < limit; i++) {
      expect((await dataPOST(request(body, { "x-real-ip": "203.0.113.5" }))).status).toBe(200)
    }
    const res = await dataPOST(request(body, { "x-real-ip": "203.0.113.5" }))
    expect(res.status).toBe(429)
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0)
    expect((await res.json()).error).toMatch(/too many requests/i)
    expect(mockLoadModuleData).toHaveBeenCalledTimes(limit)
  })

  it("keys anonymous callers by IP and signed-in callers by user id", async () => {
    for (let i = 0; i < limit; i++) await dataPOST(request(body, { "x-real-ip": "203.0.113.5" }))
    expect((await dataPOST(request(body, { "x-real-ip": "203.0.113.5" }))).status).toBe(429)
    // Another IP, and a signed-in user on the same IP, have their own budgets.
    expect((await dataPOST(request(body, { "x-real-ip": "203.0.113.9" }))).status).toBe(200)
    mockAuth.getUserId.mockResolvedValue("reader-1")
    expect((await dataPOST(request(body, { "x-real-ip": "203.0.113.5" }))).status).toBe(200)
  })

  it("caps a caller across languages so scraping can't fan out", async () => {
    const { limit: callerLimit } = MODULE_RATE_LIMITS.dataCaller
    mockAuth.getUserId.mockResolvedValue("scraper-1")
    for (let i = 0; i < callerLimit; i++) {
      const res = await dataPOST(request({ ...body, languageId: `lang-${i}` }))
      expect(res.status).toBe(200)
    }
    expect((await dataPOST(request({ ...body, languageId: "lang-fresh" }))).status).toBe(429)
  })
})

describe("POST /api/modules/playground", () => {
  const body = { languageId: "lang-1", method: "getDictionary" }

  it("only reads languages the caller can manage modules for", async () => {
    mockAuth.canEditScope.mockResolvedValue(false)
    const res = await playgroundPOST(request(body))
    expect(res.status).toBe(403)
    expect(mockLoadModuleData).not.toHaveBeenCalled()
  })

  it("rate limits per user", async () => {
    mockAuth.getUserId.mockResolvedValue("dev-1")
    for (let i = 0; i < MODULE_RATE_LIMITS.playground.limit; i++) {
      expect((await playgroundPOST(request(body))).status).toBe(200)
    }
    expect((await playgroundPOST(request(body))).status).toBe(429)
  })
})
