/**
 * REAL-DATABASE test for the bounded flashcard pool.
 *
 * Opt-in: runs only when DATABASE_URL points at a disposable local database whose
 * name starts with `lingocon_rewrite_test_` (migrations already applied). It
 * creates and deletes its own rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { FLASHCARD_POOL_LIMIT, getFlashcardPool } from "@/lib/services/flashcard-pool"

const url = process.env.DATABASE_URL ?? ""
// Whole-string match: no query parameters (Prisma's ?host= could point elsewhere).
const enabled = /^postgresql:\/\/[^@/?#]+@(localhost|127\.0\.0\.1)(:\d+)?\/lingocon_rewrite_test_\w+$/.test(url)

describe.runIf(enabled)("flashcard pool (real Postgres)", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const ownerId = `fc-owner-${suffix}`
  const smallId = `fc-small-${suffix}`
  const largeId = `fc-large-${suffix}`

  beforeAll(async () => {
    await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } })
    await prisma.language.createMany({ data: [
      { id: smallId, slug: smallId, name: "Small", ownerId },
      { id: largeId, slug: largeId, name: "Large", ownerId },
    ] })
    await prisma.dictionaryEntry.createMany({ data: [
      { languageId: smallId, lemma: "ka", gloss: "one", partOfSpeech: "noun" },
      { languageId: smallId, lemma: "ti", gloss: "two", partOfSpeech: null },
    ] })
    // Large: many nouns, a rare part of speech, and untagged entries.
    await prisma.dictionaryEntry.createMany({ data: [
      ...Array.from({ length: FLASHCARD_POOL_LIMIT + 1500 }, (_, i) => ({ languageId: largeId, lemma: `n${i}`, gloss: `noun ${i}`, partOfSpeech: "noun" })),
      ...Array.from({ length: 30 }, (_, i) => ({ languageId: largeId, lemma: `p${i}`, gloss: `particle ${i}`, partOfSpeech: "particle" })),
      ...Array.from({ length: 500 }, (_, i) => ({ languageId: largeId, lemma: `u${i}`, gloss: `untagged ${i}`, partOfSpeech: null })),
    ] })
  }, 60_000)

  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: { in: [smallId, largeId] } } })
    await prisma.user.deleteMany({ where: { id: ownerId } })
    await prisma.$disconnect()
  })

  it("returns every entry of a dictionary that fits the limit", async () => {
    const pool = await getFlashcardPool(smallId)
    expect(pool.map((e) => e.lemma).sort()).toEqual(["ka", "ti"])
  })

  it("bounds a large dictionary while keeping every part of speech available", async () => {
    const pool = await getFlashcardPool(largeId)
    expect(pool.length).toBeLessThanOrEqual(FLASHCARD_POOL_LIMIT)
    const byPos = new Map<string | null, number>()
    for (const entry of pool) byPos.set(entry.partOfSpeech, (byPos.get(entry.partOfSpeech) ?? 0) + 1)
    expect(byPos.get("particle")).toBe(30) // a rare category is kept whole
    expect(byPos.get("noun")).toBeGreaterThanOrEqual(4)
    expect(byPos.get(null)).toBeGreaterThanOrEqual(4)
    expect(new Set(pool.map((e) => e.id)).size).toBe(pool.length)
  })

  it("returns an empty pool for an empty dictionary", async () => {
    expect(await getFlashcardPool(`missing-${suffix}`)).toEqual([])
  })
})
