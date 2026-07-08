import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { searchFts } from "@/lib/services/search-fts"

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$queryRaw.mockResolvedValue([])
})

describe("searchFts", () => {
  it("returns empty buckets for queries shorter than 2 chars without querying", async () => {
    const result = await searchFts("a")
    expect(result).toEqual({ languages: [], entries: [], grammarPages: [], articles: [], texts: [] })
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
  })

  it("scope 'all' runs all five queries", async () => {
    await searchFts("water")
    expect(mockPrisma.$queryRaw.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it("scope 'dictionary' only queries entries", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: "e1", lemma: "aqua", gloss: "water", ipa: "ˈa.kwa",
        languageId: "l1", languageName: "Novian", languageSlug: "novian", languageFontFamily: null,
      },
    ])
    const result = await searchFts("aqua", "dictionary")
    expect(result.entries).toEqual([
      {
        id: "e1", lemma: "aqua", gloss: "water", ipa: "ˈa.kwa",
        language: { id: "l1", name: "Novian", slug: "novian", fontFamily: null },
      },
    ])
    expect(result.languages).toEqual([])
    expect(result.grammarPages).toEqual([])
  })

  it("reshapes language rows including counts", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: "l1", name: "Novian", slug: "novian", description: "a lang", flagUrl: null,
        ownerName: "Alex", ownerImage: null,
        scriptSymbols: 12, grammarPages: 3, dictionaryEntries: 240,
      },
    ])
    const result = await searchFts("novian", "languages")
    expect(result.languages).toEqual([
      {
        id: "l1", name: "Novian", slug: "novian", description: "a lang", flagUrl: null,
        owner: { name: "Alex", image: null },
        _count: { scriptSymbols: 12, grammarPages: 3, dictionaryEntries: 240 },
      },
    ])
  })

  it("falls back to trigram similarity for entries when FTS finds nothing", async () => {
    // Entry search now runs 3 queries: FTS, inflected-form match, then the
    // trigram fuzzy fallback (FTS + inflected both empty → fuzzy supplies it).
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // FTS
      .mockResolvedValueOnce([]) // inflected forms
      .mockResolvedValueOnce([   // fuzzy fallback
        {
          id: "e1", lemma: "aqua", gloss: "water", ipa: null,
          languageId: "l1", languageName: "Novian", languageSlug: "novian", languageFontFamily: null,
        },
      ])
    const result = await searchFts("aqva", "dictionary")
    expect(result.entries).toHaveLength(1)
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3)
  })

  it("surfaces the base entry when the query matches an INFLECTED form", async () => {
    // FTS empty, but an inflected form (e.g. "ran") maps back to entry "run".
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // FTS
      .mockResolvedValueOnce([   // inflected-form match
        {
          id: "e-run", lemma: "run", gloss: "to run", ipa: null,
          languageId: "l1", languageName: "Novian", languageSlug: "novian", languageFontFamily: null,
        },
      ])
    const result = await searchFts("ran", "dictionary")
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].lemma).toBe("run")
  })
})
