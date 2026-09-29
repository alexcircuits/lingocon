import { describe, it, expect, vi, beforeEach } from "vitest"
import type { RuntimeMethod } from "../runtime-protocol"

// Hoisted mocks (vi.mock factories run before variable declarations)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    language: { findUnique: vi.fn() },
    dictionaryEntry: { findMany: vi.fn() },
    scriptSymbol: { findMany: vi.fn() },
    paradigm: { findMany: vi.fn() },
    grammarPage: { findMany: vi.fn() },
    text: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { loadModuleData } from "../data"

const LANGUAGE_ID = "lang-123"

const METHODS: RuntimeMethod[] = [
  "getLanguage",
  "getDictionary",
  "getPhonology",
  "getParadigms",
  "getGrammar",
  "getTexts",
]

beforeEach(() => {
  vi.resetAllMocks()
  mockPrisma.language.findUnique.mockResolvedValue({
    name: "Test",
    slug: "test",
    description: null,
    metadata: null,
  })
  mockPrisma.dictionaryEntry.findMany.mockResolvedValue([])
  mockPrisma.scriptSymbol.findMany.mockResolvedValue([])
  mockPrisma.paradigm.findMany.mockResolvedValue([])
  mockPrisma.grammarPage.findMany.mockResolvedValue([])
  mockPrisma.text.findMany.mockResolvedValue([])
})

/** First argument of the first call to a mocked Prisma query. */
function queryArgs(fn: ReturnType<typeof vi.fn>) {
  expect(fn).toHaveBeenCalledTimes(1)
  return fn.mock.calls[0][0]
}

/** Keys of a Prisma `select` object, sorted for stable comparison. */
function selectedFields(fn: ReturnType<typeof vi.fn>): string[] {
  return Object.keys(queryArgs(fn).select).sort()
}

const ALL_QUERIES = {
  "language.findUnique": mockPrisma.language.findUnique,
  "dictionaryEntry.findMany": mockPrisma.dictionaryEntry.findMany,
  "scriptSymbol.findMany": mockPrisma.scriptSymbol.findMany,
  "paradigm.findMany": mockPrisma.paradigm.findMany,
  "grammarPage.findMany": mockPrisma.grammarPage.findMany,
  "text.findMany": mockPrisma.text.findMany,
}

/** Every query issued so far, across all models. */
function issuedQueries() {
  return Object.entries(ALL_QUERIES).flatMap(([name, fn]) =>
    fn.mock.calls.map(([args]) => ({ name, args }))
  )
}

describe("loadModuleData", () => {
  describe("getLanguage", () => {
    it("returns the language's public metadata", async () => {
      const row = { name: "Tala", slug: "tala", description: "A test language" }
      mockPrisma.language.findUnique.mockResolvedValue(row)

      expect(await loadModuleData("getLanguage", LANGUAGE_ID)).toEqual(row)
    })

    it("looks the language up by id", async () => {
      await loadModuleData("getLanguage", LANGUAGE_ID)

      expect(queryArgs(mockPrisma.language.findUnique).where).toEqual({ id: LANGUAGE_ID })
    })

    it("selects only name, slug and description", async () => {
      await loadModuleData("getLanguage", LANGUAGE_ID)

      expect(selectedFields(mockPrisma.language.findUnique)).toEqual(["description", "name", "slug"])
    })

    it("returns an empty placeholder when the language does not exist", async () => {
      mockPrisma.language.findUnique.mockResolvedValue(null)

      expect(await loadModuleData("getLanguage", LANGUAGE_ID)).toEqual({
        name: "",
        slug: "",
        description: null,
      })
    })
  })

  describe("getDictionary", () => {
    it("returns the entries wrapped in { entries }", async () => {
      const rows = [
        { lemma: "tala", gloss: "to speak", ipa: "ta.la", partOfSpeech: "verb", paradigmId: null },
        { lemma: "vesi", gloss: "water", ipa: null, partOfSpeech: "noun", paradigmId: "p1" },
      ]
      mockPrisma.dictionaryEntry.findMany.mockResolvedValue(rows)

      expect(await loadModuleData("getDictionary", LANGUAGE_ID)).toEqual({ entries: rows })
    })

    it("returns an empty list for a language with no entries", async () => {
      expect(await loadModuleData("getDictionary", LANGUAGE_ID)).toEqual({ entries: [] })
    })

    it("queries entries of the requested language, ordered by lemma", async () => {
      await loadModuleData("getDictionary", LANGUAGE_ID)

      const args = queryArgs(mockPrisma.dictionaryEntry.findMany)
      expect(args.where).toEqual({ languageId: LANGUAGE_ID })
      expect(args.orderBy).toEqual({ lemma: "asc" })
    })

    it("exposes only the fields a module needs", async () => {
      await loadModuleData("getDictionary", LANGUAGE_ID)

      expect(selectedFields(mockPrisma.dictionaryEntry.findMany)).toEqual([
        "gloss",
        "ipa",
        "lemma",
        "paradigmId",
        "partOfSpeech",
      ])
    })
  })

  describe("getPhonology", () => {
    const symbols = [
      { symbol: "a", ipa: "a", latin: "a", name: "A" },
      { symbol: "b", ipa: "b", latin: "b", name: "B" },
      { symbol: "i", ipa: "i", latin: "i", name: "I" },
    ]

    it("returns symbols plus the vowel inventory and chart derived from them", async () => {
      mockPrisma.scriptSymbol.findMany.mockResolvedValue(symbols)

      const result = (await loadModuleData("getPhonology", LANGUAGE_ID)) as {
        symbols: unknown[]
        vowels: string[]
        vowelChart: Array<{ ipa: string }>
        unknownVowels: string[]
      }

      expect(Object.keys(result).sort()).toEqual(["symbols", "unknownVowels", "vowelChart", "vowels"])
      expect(result.symbols).toEqual(symbols)
      expect(result.vowels).toEqual(["a", "i"])
      // Chart points are ordered close -> open, so /i/ comes before /a/.
      expect(result.vowelChart.map((p) => p.ipa)).toEqual(["i", "a"])
      expect(result.unknownVowels).toEqual([])
    })

    it("uses the language's phonology override from its metadata", async () => {
      mockPrisma.scriptSymbol.findMany.mockResolvedValue(symbols)
      mockPrisma.language.findUnique.mockResolvedValue({
        metadata: { phonologyOverride: { enabled: true, vowels: ["e", "ʘ"] } },
      })

      const result = (await loadModuleData("getPhonology", LANGUAGE_ID)) as {
        vowels: string[]
        vowelChart: Array<{ ipa: string }>
        unknownVowels: string[]
      }

      expect(result.vowels).toEqual(["e", "ʘ"])
      expect(result.vowelChart.map((p) => p.ipa)).toEqual(["e"])
      expect(result.unknownVowels).toEqual(["ʘ"])
    })

    it("still returns symbols when the language row is missing", async () => {
      mockPrisma.language.findUnique.mockResolvedValue(null)
      mockPrisma.scriptSymbol.findMany.mockResolvedValue(symbols)

      const result = (await loadModuleData("getPhonology", LANGUAGE_ID)) as {
        symbols: unknown[]
        vowels: string[]
      }

      expect(result.symbols).toEqual(symbols)
      expect(result.vowels).toEqual(["a", "i"])
    })

    it("returns empty collections for a language with no symbols", async () => {
      expect(await loadModuleData("getPhonology", LANGUAGE_ID)).toEqual({
        symbols: [],
        vowels: [],
        vowelChart: [],
        unknownVowels: [],
      })
    })

    it("reads only the language's metadata column", async () => {
      await loadModuleData("getPhonology", LANGUAGE_ID)

      const args = queryArgs(mockPrisma.language.findUnique)
      expect(args.where).toEqual({ id: LANGUAGE_ID })
      expect(selectedFields(mockPrisma.language.findUnique)).toEqual(["metadata"])
    })

    it("queries symbols of the requested language in display order", async () => {
      await loadModuleData("getPhonology", LANGUAGE_ID)

      const args = queryArgs(mockPrisma.scriptSymbol.findMany)
      expect(args.where).toEqual({ languageId: LANGUAGE_ID })
      expect(args.orderBy).toEqual({ order: "asc" })
      expect(selectedFields(mockPrisma.scriptSymbol.findMany)).toEqual(["ipa", "latin", "name", "symbol"])
    })
  })

  describe("getParadigms", () => {
    it("renames dictionaryEntries to words and drops every other column", async () => {
      mockPrisma.paradigm.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "Noun",
          slots: [{ key: "nom.sg" }],
          languageId: "should-not-leak",
          dictionaryEntries: [{ lemma: "vesi", gloss: "water" }],
        },
      ])

      const result = (await loadModuleData("getParadigms", LANGUAGE_ID)) as {
        paradigms: Array<Record<string, unknown>>
      }

      expect(result.paradigms).toStrictEqual([
        {
          id: "p1",
          name: "Noun",
          slots: [{ key: "nom.sg" }],
          words: [{ lemma: "vesi", gloss: "water" }],
        },
      ])
      expect(result.paradigms[0]).not.toHaveProperty("dictionaryEntries")
    })

    it("preserves paradigm order and one result per paradigm", async () => {
      mockPrisma.paradigm.findMany.mockResolvedValue([
        { id: "p1", name: "Adjective", slots: [], dictionaryEntries: [] },
        { id: "p2", name: "Noun", slots: [], dictionaryEntries: [] },
      ])

      const result = (await loadModuleData("getParadigms", LANGUAGE_ID)) as {
        paradigms: Array<{ id: string }>
      }

      expect(result.paradigms.map((p) => p.id)).toEqual(["p1", "p2"])
    })

    it("only includes linked words from the same language", async () => {
      await loadModuleData("getParadigms", LANGUAGE_ID)
      const args = queryArgs(mockPrisma.paradigm.findMany) as {
        select: { dictionaryEntries: { where: unknown } }
      }
      expect(args.select.dictionaryEntries.where).toEqual({ languageId: LANGUAGE_ID })
    })

    it("returns an empty list for a language with no paradigms", async () => {
      expect(await loadModuleData("getParadigms", LANGUAGE_ID)).toEqual({ paradigms: [] })
    })

    it("queries paradigms of the requested language, ordered by name", async () => {
      await loadModuleData("getParadigms", LANGUAGE_ID)

      const args = queryArgs(mockPrisma.paradigm.findMany)
      expect(args.where).toEqual({ languageId: LANGUAGE_ID })
      expect(args.orderBy).toEqual({ name: "asc" })
      expect(selectedFields(mockPrisma.paradigm.findMany)).toEqual([
        "dictionaryEntries",
        "id",
        "name",
        "slots",
      ])
    })

    it("only includes the lemma and gloss of each paradigm's words", async () => {
      await loadModuleData("getParadigms", LANGUAGE_ID)

      const nested = queryArgs(mockPrisma.paradigm.findMany).select.dictionaryEntries
      expect(Object.keys(nested.select).sort()).toEqual(["gloss", "lemma"])
    })
  })

  describe("getGrammar", () => {
    it("returns the page index wrapped in { pages }", async () => {
      const rows = [
        { slug: "intro", title: "Introduction", order: 0 },
        { slug: "verbs", title: "Verbs", order: 1 },
      ]
      mockPrisma.grammarPage.findMany.mockResolvedValue(rows)

      expect(await loadModuleData("getGrammar", LANGUAGE_ID)).toEqual({ pages: rows })
    })

    it("queries pages of the requested language in page order, without their content", async () => {
      await loadModuleData("getGrammar", LANGUAGE_ID)

      const args = queryArgs(mockPrisma.grammarPage.findMany)
      expect(args.where).toEqual({ languageId: LANGUAGE_ID })
      expect(args.orderBy).toEqual({ order: "asc" })
      expect(selectedFields(mockPrisma.grammarPage.findMany)).toEqual(["order", "slug", "title"])
    })
  })

  describe("getTexts", () => {
    it("returns the texts wrapped in { texts }", async () => {
      const rows = [{ slug: "first", title: "First text" }]
      mockPrisma.text.findMany.mockResolvedValue(rows)

      expect(await loadModuleData("getTexts", LANGUAGE_ID)).toEqual({ texts: rows })
    })

    it("only returns published texts of the requested language, newest first", async () => {
      await loadModuleData("getTexts", LANGUAGE_ID)

      const args = queryArgs(mockPrisma.text.findMany)
      expect(args.where).toEqual({ languageId: LANGUAGE_ID, published: true })
      expect(args.orderBy).toEqual({ createdAt: "desc" })
      expect(selectedFields(mockPrisma.text.findMany)).toEqual(["slug", "title"])
    })
  })

  describe("hard row caps", () => {
    // Every findMany a module can trigger is bounded, so an author's widget can't
    // pull an unbounded table through the host.
    it.each([
      ["getDictionary", "dictionaryEntry", 2000],
      ["getPhonology", "scriptSymbol", 1000],
      ["getParadigms", "paradigm", 200],
      ["getGrammar", "grammarPage", 200],
      ["getTexts", "text", 100],
    ] as const)("%s reads at most %i rows from %s", async (method, model, cap) => {
      await loadModuleData(method, LANGUAGE_ID)

      expect(queryArgs(mockPrisma[model].findMany).take).toBe(cap)
    })

    it("getParadigms also caps the words attached to each paradigm at 500", async () => {
      await loadModuleData("getParadigms", LANGUAGE_ID)

      const nested = queryArgs(mockPrisma.paradigm.findMany).select.dictionaryEntries
      expect(nested.take).toBe(500)
    })

    it.each(METHODS)("%s never issues an unbounded findMany", async (method) => {
      await loadModuleData(method, LANGUAGE_ID)

      const lists = issuedQueries().filter((q) => q.name.endsWith(".findMany"))
      for (const { name, args } of lists) {
        expect(args.take, `${name} must set take`).toEqual(expect.any(Number))
        expect(args.take).toBeGreaterThan(0)
      }
    })
  })

  describe("language scoping", () => {
    it.each(METHODS)("%s scopes every query to the requested language", async (method) => {
      await loadModuleData(method, "lang-scoped")

      const queries = issuedQueries()
      expect(queries.length).toBeGreaterThan(0)
      for (const { name, args } of queries) {
        if (name === "language.findUnique") {
          expect(args.where, name).toEqual({ id: "lang-scoped" })
        } else {
          expect(args.where.languageId, name).toBe("lang-scoped")
        }
      }
    })

    it("uses the language id of each call, not a previous one", async () => {
      await loadModuleData("getDictionary", "lang-a")
      await loadModuleData("getDictionary", "lang-b")

      const scopes = mockPrisma.dictionaryEntry.findMany.mock.calls.map(([args]) => args.where.languageId)
      expect(scopes).toEqual(["lang-a", "lang-b"])
    })
  })

  describe("error handling", () => {
    it.each([
      ["getLanguage", "language", "findUnique"],
      ["getDictionary", "dictionaryEntry", "findMany"],
      ["getPhonology", "language", "findUnique"],
      ["getPhonology", "scriptSymbol", "findMany"],
      ["getParadigms", "paradigm", "findMany"],
      ["getGrammar", "grammarPage", "findMany"],
      ["getTexts", "text", "findMany"],
    ] as const)("%s propagates a %s.%s failure", async (method, model, op) => {
      const query = mockPrisma[model] as unknown as Record<string, ReturnType<typeof vi.fn>>
      query[op].mockRejectedValue(new Error("db down"))

      await expect(loadModuleData(method, LANGUAGE_ID)).rejects.toThrow("db down")
    })
  })

  describe("unknown methods", () => {
    it.each(["getSecrets", "constructor", "__proto__", ""])(
      "returns {} and touches no table for %j",
      async (method) => {
        const result = await loadModuleData(method as RuntimeMethod, LANGUAGE_ID)

        expect(result).toEqual({})
        expect(issuedQueries()).toHaveLength(0)
      }
    )
  })
})
