// @vitest-environment node
/**
 * REAL-DATABASE tests for saving articles, texts and grammar pages from the studio editors:
 * renames revalidate both URLs, explicit nulls clear optional fields, and saves carry an
 * optimistic revision (`expectedUpdatedAt`) so a stale tab cannot overwrite newer content.
 *
 * Opt-in: runs only when DATABASE_URL points at a local throwaway `lingocon_rewrite_test_*`
 * database with the migrations applied. It creates and deletes only its own rows.
 *
 *   DATABASE_URL=postgresql://localhost:5432/lingocon_rewrite_test_x npx vitest run document-editor-saves
 */
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"

const actor = vi.hoisted(() => ({ id: "" }))
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: actor.id } }) }))
vi.mock("@/app/actions/badge", () => ({
  checkContentBadges: async () => undefined,
  checkGrammarBadges: async () => undefined,
}))

import { prisma } from "@/lib/prisma"
import { ConflictError } from "@/lib/errors"
import * as articleService from "../article"
import * as grammarService from "../grammar-page"
import { updateArticle } from "@/app/actions/article"
import { updateText } from "@/app/actions/text"
import { updateGrammarPage } from "@/app/actions/grammar-page"

function isLocalRewriteTestDatabase(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_[a-z0-9_]+$/.test(url.pathname)
      && url.search === "" // ?host= etc. could point Prisma elsewhere
  } catch {
    return false
  }
}
const enabled = isLocalRewriteTestDatabase(process.env.DATABASE_URL)

const prefix = `docsave-${randomUUID().slice(0, 8)}`
const owner = `${prefix}-owner`
const languageId = `${prefix}-lang`
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
const revalidated = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const suffix = () => randomUUID().slice(0, 8)

interface SaveOutcome { updatedAt?: Date; error?: string; conflict?: boolean }
interface DocumentKind {
  create: () => Promise<{ id: string; updatedAt: Date }>
  save: (id: string, body: string, expectedUpdatedAt?: string) => Promise<SaveOutcome>
  serviceSave: (id: string, body: string, expectedUpdatedAt: string) => Promise<unknown>
  content: (id: string) => Promise<unknown>
}

/** Normalizes the three action envelopes to the fields these tests assert on. */
function outcome(result: object, key: string): SaveOutcome {
  const record = result as Record<string, unknown>
  if (typeof record.error === "string") return { error: record.error, conflict: record.conflict === true }
  return { updatedAt: (record[key] as { updatedAt: Date }).updatedAt }
}

const createArticleRow = (title = `Article ${suffix()}`, extra: Record<string, unknown> = {}) =>
  prisma.article.create({
    data: { title, slug: `article-${suffix()}`, content: doc("original"), published: true, languageId, authorId: owner, ...extra },
  })
const createTextRow = (title = `Text ${suffix()}`, extra: Record<string, unknown> = {}) =>
  prisma.text.create({
    data: { title, slug: `text-${suffix()}`, content: doc("original"), published: true, languageId, authorId: owner, ...extra },
  })
const createGrammarRow = (slug = `grammar-${suffix()}`, extra: Record<string, unknown> = {}) =>
  prisma.grammarPage.create({ data: { title: "Grammar", slug, content: doc("original"), languageId, ...extra } })

const kinds: Record<"article" | "text" | "grammar page", DocumentKind> = {
  article: {
    create: () => createArticleRow(),
    save: async (id, body, expectedUpdatedAt) =>
      outcome(await updateArticle(id, { content: doc(body), expectedUpdatedAt }), "article"),
    serviceSave: (id, body, expectedUpdatedAt) =>
      articleService.updateArticle(id, { content: doc(body), expectedUpdatedAt }, owner),
    content: async (id) => (await prisma.article.findUniqueOrThrow({ where: { id } })).content,
  },
  text: {
    create: () => createTextRow(),
    save: async (id, body, expectedUpdatedAt) =>
      outcome(await updateText(id, { content: doc(body), expectedUpdatedAt }), "text"),
    serviceSave: async (id, body, expectedUpdatedAt) => {
      const textService = await import("../text")
      return textService.updateText(id, { content: doc(body), expectedUpdatedAt }, owner)
    },
    content: async (id) => (await prisma.text.findUniqueOrThrow({ where: { id } })).content,
  },
  "grammar page": {
    create: () => createGrammarRow(),
    save: async (id, body, expectedUpdatedAt) =>
      outcome(await updateGrammarPage({ id, languageId, content: doc(body), expectedUpdatedAt }), "data"),
    serviceSave: (id, body, expectedUpdatedAt) =>
      grammarService.updatePage({ id, languageId, content: doc(body), expectedUpdatedAt }, owner),
    content: async (id) => (await prisma.grammarPage.findUniqueOrThrow({ where: { id } })).content,
  },
}

describe.runIf(enabled)("document editor saves (real Postgres)", () => {
  beforeAll(async () => {
    actor.id = owner
    await prisma.user.create({ data: { id: owner, email: `${owner}@example.test` } })
    await prisma.language.create({ data: { id: languageId, slug: languageId, name: prefix, ownerId: owner } })
  })
  afterAll(async () => {
    // Cascades remove the language's articles, texts, grammar pages and paradigms.
    await prisma.language.deleteMany({ where: { id: languageId } })
    await prisma.user.deleteMany({ where: { id: owner } })
    await prisma.$disconnect()
  })
  beforeEach(() => { vi.mocked(revalidatePath).mockClear() })

  describe("renames that change the URL", () => {
    it("returns the new article slug and revalidates the previous and the new URLs", async () => {
      const article = await createArticleRow("Old article", { slug: `old-article-${suffix()}` })
      const result = await updateArticle(article.id, { title: `Renamed article ${article.id}` })
      const newSlug = `renamed-article-${article.id}`.slice(0, 50).replace(/-+$/, "")
      expect(result).toMatchObject({ article: { slug: newSlug } })
      expect(revalidated()).toEqual(expect.arrayContaining([
        `/studio/lang/${languageId}/articles/${article.slug}`, `/lang/${languageId}/articles/${article.slug}`,
        `/studio/lang/${languageId}/articles/${newSlug}`, `/lang/${languageId}/articles/${newSlug}`,
      ]))
    })

    it("returns the new text slug and revalidates the previous and the new URLs", async () => {
      const text = await createTextRow("Old text", { slug: `old-text-${suffix()}` })
      const result = await updateText(text.id, { title: `Renamed text ${text.id}` })
      const newSlug = `renamed-text-${text.id}`.slice(0, 50).replace(/-+$/, "")
      expect(result).toMatchObject({ text: { slug: newSlug } })
      expect(revalidated()).toEqual(expect.arrayContaining([
        `/studio/lang/${languageId}/texts/${text.slug}`, `/lang/${languageId}/texts/${text.slug}`,
        `/studio/lang/${languageId}/texts/${newSlug}`, `/lang/${languageId}/texts/${newSlug}`,
      ]))
    })

    it("returns the new grammar slug and revalidates the previous and the new URLs", async () => {
      const oldSlug = `old-cases-${suffix()}`
      const newSlug = `noun-cases-${suffix()}`
      const page = await createGrammarRow(oldSlug)
      const result = await updateGrammarPage({ id: page.id, languageId, slug: newSlug })
      expect(result).toMatchObject({ success: true, data: { slug: newSlug } })
      expect(revalidated()).toEqual(expect.arrayContaining([
        `/studio/lang/${languageId}/grammar/${oldSlug}`, `/lang/${languageId}/grammar/${oldSlug}`,
        `/studio/lang/${languageId}/grammar/${newSlug}`, `/lang/${languageId}/grammar/${newSlug}`,
      ]))
    })
  })

  describe("clearing optional fields", () => {
    it("keeps an article cover when omitted and clears it on an explicit null", async () => {
      const article = await createArticleRow(undefined, { coverImage: "https://example.test/cover.png" })
      await updateArticle(article.id, { content: doc("still covered") })
      expect((await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).coverImage).toBe("https://example.test/cover.png")
      expect(await updateArticle(article.id, { coverImage: null })).toMatchObject({ article: { coverImage: null } })
      expect((await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).coverImage).toBeNull()
    })

    it("keeps a text paradigm when omitted and clears it on an explicit null", async () => {
      const paradigm = await prisma.paradigm.create({ data: { languageId, name: `Paradigm ${suffix()}`, slots: {} } })
      const text = await createTextRow(undefined, { paradigmId: paradigm.id })
      await updateText(text.id, { content: doc("still linked") })
      expect((await prisma.text.findUniqueOrThrow({ where: { id: text.id } })).paradigmId).toBe(paradigm.id)
      expect(await updateText(text.id, { paradigmId: null })).toMatchObject({ text: { paradigmId: null } })
      expect((await prisma.text.findUniqueOrThrow({ where: { id: text.id } })).paradigmId).toBeNull()
    })

    it("keeps a grammar image when omitted and clears it on an explicit null", async () => {
      const page = await createGrammarRow(undefined, { imageUrl: "https://example.test/g.png" })
      await updateGrammarPage({ id: page.id, languageId, content: doc("still illustrated") })
      expect((await prisma.grammarPage.findUniqueOrThrow({ where: { id: page.id } })).imageUrl).toBe("https://example.test/g.png")
      expect(await updateGrammarPage({ id: page.id, languageId, imageUrl: null })).toMatchObject({ success: true, data: { imageUrl: null } })
      expect((await prisma.grammarPage.findUniqueOrThrow({ where: { id: page.id } })).imageUrl).toBeNull()
    })

    it("keeps texts published on save (the editor no longer offers a Draft switch)", async () => {
      const text = await createTextRow()
      expect(await updateText(text.id, { content: doc("edited"), published: false })).toMatchObject({ text: { published: true } })
    })
  })

  describe.each(Object.entries(kinds))("%s revision checks", (_name, kind) => {
    it("rejects a save prepared against an older revision without overwriting newer content", async () => {
      const row = await kind.create()
      const loaded = row.updatedAt.toISOString()
      const first = await kind.save(row.id, "tab A", loaded)
      expect(first.error).toBeUndefined()
      const stale = await kind.save(row.id, "stale tab B", loaded)
      expect(stale).toMatchObject({ error: expect.any(String), conflict: true })
      expect(await kind.content(row.id)).toEqual(doc("tab A"))
      await expect(kind.serviceSave(row.id, "stale service write", loaded)).rejects.toBeInstanceOf(ConflictError)
      expect(await kind.content(row.id)).toEqual(doc("tab A"))
    })

    it("accepts consecutive saves that adopt the returned revision, and saves without one", async () => {
      const row = await kind.create()
      const first = await kind.save(row.id, "first", row.updatedAt.toISOString())
      const second = await kind.save(row.id, "second", first.updatedAt!.toISOString())
      expect(second.error).toBeUndefined()
      expect(second.updatedAt!.getTime()).toBeGreaterThan(first.updatedAt!.getTime())
      expect((await kind.save(row.id, "legacy client")).error).toBeUndefined()
      expect(await kind.content(row.id)).toEqual(doc("legacy client"))
    })

    it("lets exactly one of two concurrent saves from the same revision win", async () => {
      const row = await kind.create()
      const loaded = row.updatedAt.toISOString()
      const results = await Promise.all([kind.save(row.id, "left", loaded), kind.save(row.id, "right", loaded)])
      expect(results.filter((result) => result.conflict)).toHaveLength(1)
      const winner = results.findIndex((result) => !result.error)
      expect(await kind.content(row.id)).toEqual(doc(winner === 0 ? "left" : "right"))
    })

    it("rejects a malformed revision instead of skipping the check", async () => {
      const row = await kind.create()
      expect((await kind.save(row.id, "malformed", "not-a-date")).error).toEqual(expect.any(String))
      expect(await kind.content(row.id)).toEqual(doc("original"))
    })
  })
})
