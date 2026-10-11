// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getValidationWarnings } from "@/lib/utils/validation"
import { matchSwadeshList } from "@/lib/data/swadesh-list"

const { mockPrisma, mockService, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    scriptSymbol: { findMany: vi.fn() },
    dictionaryEntry: { findMany: vi.fn() },
    paradigm: { findMany: vi.fn() },
  },
  mockService: { getLexiconAnalysis: vi.fn() },
  mockAuth: { getUserId: vi.fn(), canViewLanguage: vi.fn() },
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/rust-api", () => mockService)
vi.mock("@/lib/auth-helpers", () => mockAuth)

import { getOverviewLexiconAnalysis, MAX_WARNINGS_SHOWN } from "@/lib/services/lexicon-analysis"

const symbols = [{ symbol: "a", capitalSymbol: "A" }, { symbol: "t", capitalSymbol: null }, { symbol: "q", capitalSymbol: null }]
const entries = [
  { lemma: "ta", gloss: "water", paradigmId: null },
  { lemma: "tax", gloss: "fire", paradigmId: "gone" },
  { lemma: "", gloss: "", paradigmId: null },
]
const paradigms = [{ id: "p1" }]

function seedDatabase(rows = entries) {
  mockPrisma.scriptSymbol.findMany.mockResolvedValue(symbols)
  mockPrisma.dictionaryEntry.findMany.mockResolvedValue(rows)
  mockPrisma.paradigm.findMany.mockResolvedValue(paradigms)
}

const devMode = process.env.DEV_MODE

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_MODE
  mockAuth.getUserId.mockResolvedValue("user-1")
  mockAuth.canViewLanguage.mockResolvedValue(true)
  mockService.getLexiconAnalysis.mockResolvedValue(null)
  seedDatabase()
})

afterEach(() => {
  if (devMode === undefined) delete process.env.DEV_MODE
  else process.env.DEV_MODE = devMode
})

describe("getOverviewLexiconAnalysis", () => {
  it("uses the Rust service's answer without loading the lexicon in Node", async () => {
    const fromService = { warnings: [], total: 0, matchedIds: [3, 8] }
    mockService.getLexiconAnalysis.mockResolvedValue(fromService)

    await expect(getOverviewLexiconAnalysis("lang-1", false)).resolves.toEqual(fromService)
    expect(mockService.getLexiconAnalysis).toHaveBeenCalledWith("lang-1")
    expect(mockPrisma.dictionaryEntry.findMany).not.toHaveBeenCalled()
  })

  it("computes the same result in TypeScript when the service is off or unavailable", async () => {
    const all = getValidationWarnings(symbols, entries, paradigms, { allowsDiacritics: false })
    const { matched } = matchSwadeshList(entries.map((entry) => entry.gloss))

    await expect(getOverviewLexiconAnalysis("lang-1", false)).resolves.toEqual({
      warnings: all.slice(0, MAX_WARNINGS_SHOWN),
      total: all.length,
      matchedIds: Array.from(matched).sort((a, b) => a - b),
    })
    expect(all.length).toBeGreaterThan(0)
    expect(matched.size).toBeGreaterThan(0)
    // Which warnings are shown must not depend on physical row order (and must
    // match the service, which reads entries in id order).
    expect(mockPrisma.dictionaryEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { languageId: "lang-1" },
      orderBy: { id: "asc" },
    }))
  })

  it("shows the first 50 warnings and counts the rest", async () => {
    seedDatabase(Array.from({ length: 120 }, (_, i) => ({ lemma: `x${i}`, gloss: `g${i}`, paradigmId: null })))

    const analysis = await getOverviewLexiconAnalysis("lang-1", false)
    expect(analysis?.warnings).toHaveLength(MAX_WARNINGS_SHOWN)
    expect(analysis?.total).toBeGreaterThan(MAX_WARNINGS_SHOWN)
  })

  it("never asks the service (which trusts its caller) for a language the user cannot view", async () => {
    mockAuth.canViewLanguage.mockResolvedValue(false)

    await expect(getOverviewLexiconAnalysis("private-lang", false)).resolves.toBeNull()
    expect(mockAuth.canViewLanguage).toHaveBeenCalledWith("private-lang", "user-1")
    expect(mockService.getLexiconAnalysis).not.toHaveBeenCalled()
    expect(mockPrisma.dictionaryEntry.findMany).not.toHaveBeenCalled()
  })

  it("returns nothing to a signed-out visitor", async () => {
    mockAuth.getUserId.mockResolvedValue(null)

    await expect(getOverviewLexiconAnalysis("lang-1", false)).resolves.toBeNull()
    expect(mockService.getLexiconAnalysis).not.toHaveBeenCalled()
  })

  it("skips the access check in DEV_MODE, like the studio layout", async () => {
    process.env.DEV_MODE = "true"
    mockAuth.getUserId.mockResolvedValue(null)

    await expect(getOverviewLexiconAnalysis("lang-1", false)).resolves.not.toBeNull()
    expect(mockAuth.canViewLanguage).not.toHaveBeenCalled()
  })
})
