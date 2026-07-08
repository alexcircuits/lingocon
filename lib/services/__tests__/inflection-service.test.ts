import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    dictionaryEntry: { findUnique: vi.fn() },
    paradigmRule: { findMany: vi.fn() },
    paradigm: { findUnique: vi.fn() },
    inflectedForm: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: unknown) => unknown)(mockPrisma) : Promise.all(arg as unknown[]),
    ),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import {
  inflectionContextFromMetadata,
  regenerateEntryForms,
  previewParadigmForms,
} from "@/lib/services/inflection-service"

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(mockPrisma) : Promise.all(arg as unknown[]),
  )
})

describe("inflectionContextFromMetadata", () => {
  it("uses the phonology override when enabled", () => {
    const ctx = inflectionContextFromMetadata({
      phonologyOverride: { enabled: true, vowels: ["a", "e"], consonants: ["p", "t"] },
    })
    expect(ctx.vowels).toEqual(new Set(["a", "e"]))
    expect(ctx.consonants).toEqual(new Set(["p", "t"]))
  })

  it("ignores a disabled or empty override", () => {
    expect(inflectionContextFromMetadata({ phonologyOverride: { enabled: false, vowels: ["a"] } })).toEqual({
      vowels: undefined,
      consonants: undefined,
    })
    expect(inflectionContextFromMetadata(null)).toEqual({ vowels: undefined, consonants: undefined })
  })
})

describe("regenerateEntryForms", () => {
  it("replaces an entry's forms from its paradigm's rules", async () => {
    mockPrisma.dictionaryEntry.findUnique.mockResolvedValueOnce({
      lemma: "kat",
      paradigmId: "p1",
      language: { metadata: null },
    })
    mockPrisma.paradigmRule.findMany.mockResolvedValueOnce([
      { cellKey: "0-0", prefix: "", suffix: "", soundChange: "" },
      { cellKey: "0-1", prefix: "", suffix: "en", soundChange: "" },
    ])

    const count = await regenerateEntryForms("e1")

    expect(count).toBe(2)
    // Old forms cleared, then new ones written in one transaction.
    expect(mockPrisma.inflectedForm.deleteMany).toHaveBeenCalledWith({ where: { entryId: "e1" } })
    const created = mockPrisma.inflectedForm.createMany.mock.calls[0][0].data
    expect(created).toEqual([
      { entryId: "e1", cellKey: "0-0", form: "kat" },
      { entryId: "e1", cellKey: "0-1", form: "katen" },
    ])
  })

  it("clears forms and skips generation when the entry has no paradigm", async () => {
    mockPrisma.dictionaryEntry.findUnique.mockResolvedValueOnce({
      lemma: "kat",
      paradigmId: null,
      language: { metadata: null },
    })

    const count = await regenerateEntryForms("e1")

    expect(count).toBe(0)
    expect(mockPrisma.inflectedForm.deleteMany).toHaveBeenCalledWith({ where: { entryId: "e1" } })
    expect(mockPrisma.inflectedForm.createMany).not.toHaveBeenCalled()
  })

  it("is a no-op for a missing entry", async () => {
    mockPrisma.dictionaryEntry.findUnique.mockResolvedValueOnce(null)
    expect(await regenerateEntryForms("nope")).toBe(0)
    expect(mockPrisma.inflectedForm.deleteMany).not.toHaveBeenCalled()
  })
})

describe("previewParadigmForms", () => {
  it("computes forms for a stem without persisting", async () => {
    mockPrisma.paradigm.findUnique.mockResolvedValueOnce({ language: { metadata: null } })
    mockPrisma.paradigmRule.findMany.mockResolvedValueOnce([
      { cellKey: "0-0", prefix: "ge-", suffix: "-t", soundChange: "" },
    ])

    const forms = await previewParadigmForms("p1", "lieb")

    expect(forms).toEqual([{ cellKey: "0-0", form: "geliebt" }])
    expect(mockPrisma.inflectedForm.createMany).not.toHaveBeenCalled()
  })
})
