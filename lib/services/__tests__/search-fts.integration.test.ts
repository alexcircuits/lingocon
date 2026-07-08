/**
 * REAL-DATABASE integration test for the FTS visibility filter.
 *
 * The unit test (search-fts.test.ts) mocks `$queryRaw`, so it can't prove the
 * `WHERE visibility = 'PUBLIC'` clauses actually keep private content out of
 * search results. This test does — against a real Postgres.
 *
 * It is OPT-IN and skipped by default (so `npm test` never touches a database):
 *
 *   RUN_FTS_INTEGRATION=1 DATABASE_URL=postgres://…/lingocon_test npm test -- search-fts.integration
 *
 * DANGER: point DATABASE_URL at a THROWAWAY test database only — the migrations
 * must already be applied there (`prisma migrate deploy`). Never run this
 * against the dev or production database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { searchFts } from "@/lib/services/search-fts"

const enabled = process.env.RUN_FTS_INTEGRATION === "1"
const run = Date.now().toString(36)
const TOKEN = `zzqxfts${run}` // unique, unlikely to collide with real data

describe.runIf(enabled)("searchFts — visibility filter (real Postgres)", () => {
  let userId: string
  let publicLangId: string
  let privateLangId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { name: `FTS Test ${run}`, email: `fts-${run}@example.test` },
    })
    userId = user.id

    const publicLang = await prisma.language.create({
      data: {
        name: `${TOKEN} Public`,
        slug: `${TOKEN}-public`,
        visibility: "PUBLIC",
        ownerId: userId,
        dictionaryEntries: { create: { lemma: TOKEN, gloss: "water" } },
      },
    })
    publicLangId = publicLang.id

    const privateLang = await prisma.language.create({
      data: {
        name: `${TOKEN} Private`,
        slug: `${TOKEN}-private`,
        visibility: "PRIVATE",
        ownerId: userId,
        dictionaryEntries: { create: { lemma: TOKEN, gloss: "water" } },
      },
    })
    privateLangId = privateLang.id
  })

  afterAll(async () => {
    // Cascades remove entries; delete languages then the user.
    await prisma.language.deleteMany({ where: { id: { in: [publicLangId, privateLangId] } } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it("returns the PUBLIC language but never the PRIVATE one", async () => {
    const res = await searchFts(TOKEN, "all")
    const langIds = res.languages.map((l) => l.id)
    expect(langIds).toContain(publicLangId)
    expect(langIds).not.toContain(privateLangId)
  })

  it("returns entries only from the PUBLIC language", async () => {
    const res = await searchFts(TOKEN, "all")
    const entryLangIds = res.entries.map((e) => e.language.id)
    expect(entryLangIds).toContain(publicLangId)
    expect(entryLangIds).not.toContain(privateLangId)
  })
})
