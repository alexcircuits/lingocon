// @vitest-environment node
import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findLanguage: vi.fn(), findArticle: vi.fn(), canEditScope: vi.fn(), canView: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { language: { findUnique: mocks.findLanguage }, article: { findUnique: mocks.findArticle } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getUserId: async () => "me", canEditScope: mocks.canEditScope, canViewLanguage: mocks.canView,
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`) },
  notFound: () => { throw new Error("notFound") },
}))
vi.mock("../article-editor", () => ({ ArticleEditor: function ArticleEditor() { return null } }))
import EditArticlePage from "../[articleSlug]/page"

const article = (overrides: Record<string, unknown> = {}) => ({
  id: "a1", title: "News", slug: "news", content: null, coverImage: null, paradigmId: null,
  published: true, authorId: "someone-else", updatedAt: new Date("2026-01-01T00:00:00.000Z"), ...overrides,
})
function grant(...scopes: string[]) {
  mocks.canEditScope.mockImplementation(async (_language: string, _user: string, scope: string) => scopes.includes(scope))
}
const open = async () =>
  (await EditArticlePage({ params: Promise.resolve({ slug: "lingua", articleSlug: "news" }) })) as ReactElement<{
    readOnly: boolean; article: Record<string, unknown>
  }>

beforeEach(() => {
  vi.resetAllMocks()
  process.env.DEV_MODE = "false"
  mocks.findLanguage.mockResolvedValue({ id: "lang-1", name: "Lingua", slug: "lingua", ownerId: "owner", grammarPages: [] })
  mocks.findArticle.mockResolvedValue(article())
  mocks.canView.mockResolvedValue(true)
  grant()
})

describe("studio article page access", () => {
  it("opens a published article read-only for a viewer, without sending its author id", async () => {
    const page = await open()
    expect(page.props.readOnly).toBe(true)
    expect(page.props.article).toMatchObject({ id: "a1" })
    expect(page.props.article).not.toHaveProperty("authorId")
  })

  it("hides an unpublished article from a viewer", async () => {
    mocks.findArticle.mockResolvedValue(article({ published: false }))
    await expect(open()).rejects.toThrow("notFound")
  })

  it("reads nothing for someone who cannot view the project", async () => {
    mocks.canView.mockResolvedValue(false)
    await expect(open()).rejects.toThrow("notFound")
    expect(mocks.findArticle).not.toHaveBeenCalled()
  })

  it("lets a draft contributor edit their own unpublished draft", async () => {
    grant("draft:articles")
    mocks.findArticle.mockResolvedValue(article({ published: false, authorId: "me" }))
    expect((await open()).props.readOnly).toBe(false)
  })

  it("opens someone else's published article read-only for a draft contributor (the server refuses the save)", async () => {
    grant("draft:articles")
    expect((await open()).props.readOnly).toBe(true)
  })

  it("lets a collaborator with write:articles edit any article", async () => {
    grant("write:articles")
    mocks.findArticle.mockResolvedValue(article({ published: false }))
    expect((await open()).props.readOnly).toBe(false)
  })
})
