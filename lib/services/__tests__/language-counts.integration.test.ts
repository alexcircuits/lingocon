/**
 * REAL-DATABASE parity test for the scoped language counts.
 *
 * Opt-in: runs only when DATABASE_URL points at a disposable local database whose
 * name starts with `lingocon_rewrite_test_` (migrations already applied). It
 * creates and deletes its own rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { getLanguageCounts, getLanguageCountsMany } from "@/lib/services/language-counts"

const url = process.env.DATABASE_URL ?? ""
// Whole-string match: no query parameters (Prisma's ?host= could point elsewhere).
const enabled = /^postgresql:\/\/[^@/?#]+@(localhost|127\.0\.0\.1)(:\d+)?\/lingocon_rewrite_test_\w+$/.test(url)

describe.runIf(enabled)("scoped language counts (real Postgres)", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const ownerId = `lc-owner-${suffix}`
  const fanId = `lc-fan-${suffix}`
  const aId = `lc-a-${suffix}`
  const bId = `lc-b-${suffix}`

  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: ownerId, email: `${ownerId}@example.test` },
      { id: fanId, email: `${fanId}@example.test` },
    ] })
    await prisma.language.createMany({ data: [
      { id: aId, slug: aId, name: "A", ownerId, visibility: "PUBLIC" },
      { id: bId, slug: bId, name: "B", ownerId },
    ] })
    await prisma.scriptSymbol.createMany({ data: [
      { languageId: aId, symbol: "a", order: 0 },
      { languageId: aId, symbol: "b", order: 1 },
    ] })
    await prisma.dictionaryEntry.createMany({ data: [
      { languageId: aId, lemma: "ka", gloss: "one" },
      { languageId: aId, lemma: "ti", gloss: "two" },
      { languageId: aId, lemma: "mu", gloss: "three" },
      { languageId: bId, lemma: "zo", gloss: "other project" },
    ] })
    await prisma.grammarPage.create({ data: { languageId: aId, title: "Nouns", slug: "nouns", content: {} } })
    await prisma.article.createMany({ data: [
      { languageId: aId, authorId: ownerId, title: "Pub", slug: "pub", content: {}, published: true },
      { languageId: aId, authorId: ownerId, title: "Draft", slug: "draft", content: {}, published: false },
    ] })
    await prisma.favorite.create({ data: { userId: fanId, languageId: aId } })
  })

  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: { in: [aId, bId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, fanId] } } })
    await prisma.$disconnect()
  })

  it("matches Prisma's relation _count for several languages at once", async () => {
    const keys = ["scriptSymbols", "grammarPages", "dictionaryEntries", "articles", "texts"] as const
    const many = await getLanguageCountsMany([aId, bId, aId], keys)
    for (const id of [aId, bId]) {
      const expected = await prisma.language.findUniqueOrThrow({
        where: { id },
        select: { _count: { select: { scriptSymbols: true, grammarPages: true, dictionaryEntries: true, articles: true, texts: true } } },
      })
      expect(many.get(id)).toEqual(expected._count)
    }
  })

  it("zero-fills IDs that match no language", async () => {
    const many = await getLanguageCountsMany([`missing-${suffix}`], ["dictionaryEntries"] as const)
    expect(many.get(`missing-${suffix}`)).toEqual({ dictionaryEntries: 0 })
    expect((await getLanguageCountsMany([], ["dictionaryEntries"] as const)).size).toBe(0)
  })

  it("counts only published articles and texts for public pages", async () => {
    const counts = await getLanguageCounts(aId, ["articles", "publishedArticles", "publishedTexts", "favorites"] as const)
    expect(counts).toEqual({ articles: 2, publishedArticles: 1, publishedTexts: 0, favorites: 1 })
  })
})
