import { isValidElement, type ReactElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findLanguage: vi.fn(),
  findPage: vi.fn(),
  findPages: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    language: { findUnique: mocks.findLanguage },
    grammarPage: { findUnique: mocks.findPage, findMany: mocks.findPages },
  },
}))
vi.mock("@/lib/auth-helpers", () => ({ getUserId: async () => "owner", canViewLanguage: async () => true }))
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND") }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/app/actions/grammar-page", () => ({}))
vi.mock("@/components/rich-text-editor", () => ({ RichTextEditor: () => null }))
vi.mock("@/components/paradigm-insert-dialog", () => ({ ParadigmInsertDialog: () => null }))
import GrammarListPage from "../page"
import EditGrammarPage from "../[pageSlug]/page"
import { GrammarPagesManager } from "../grammar-pages-manager"
import { GrammarEditor } from "../grammar-editor"

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
const updatedAt = new Date("2026-01-01T00:00:00.000Z")
const stored = [
  { id: "p1", title: "Nouns", slug: "nouns", order: 0, updatedAt, content: doc("three little words"), imageUrl: null, paradigmId: null, languageId: "lang-1", createdAt: updatedAt },
  { id: "p2", title: "Verbs", slug: "verbs", order: 1, updatedAt, content: doc(""), imageUrl: null, paradigmId: null, languageId: "lang-1", createdAt: updatedAt },
]
const symbol = { id: "s1", symbol: "a", capitalSymbol: "A", ipa: "a", latin: "a", name: null, order: 0, languageId: "lang-1", createdAt: updatedAt, updatedAt }

/** Applies a Prisma `select` to a stored row, so the mock returns what the query asked for (all fields without one). */
function project<T extends Record<string, unknown>>(row: T, select?: Record<string, unknown>) {
  return select ? Object.fromEntries(Object.keys(select).filter((key) => key in row).map((key) => [key, row[key]])) : row
}
function findElement(node: ReactNode, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type === type) return node
  return findElement((node.props as { children?: ReactNode }).children, type)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findLanguage.mockImplementation(async ({ select }: { select: Record<string, { select?: Record<string, unknown> }> }) => ({
    id: "lang-1", name: "Lingua", slug: "lingua", ownerId: "owner",
    ...(select.grammarPages ? { grammarPages: stored.map((row) => project(row, select.grammarPages.select)) } : {}),
    ...(select.scriptSymbols ? { scriptSymbols: [project(symbol, select.scriptSymbols.select)] } : {}),
  }))
  mocks.findPage.mockImplementation(async ({ where }: { where: { languageId_slug: { slug: string } } }) =>
    stored.find((row) => row.slug === where.languageId_slug.slug) ?? null)
  mocks.findPages.mockImplementation(async ({ where, select }: { where: { slug: { not: string } }; select: Record<string, unknown> }) =>
    stored.filter((row) => row.slug !== where.slug.not).map((row) => project(row, select)))
})

describe("grammar studio queries", () => {
  it("sends the page list to the client without page documents, keeping word counts", async () => {
    const tree = await GrammarListPage({ params: Promise.resolve({ slug: "lingua" }) })
    const manager = findElement(tree, GrammarPagesManager)
    expect(manager).not.toBeNull()
    const props = manager!.props as { pages: Record<string, unknown>[]; wordCountsById: Record<string, number> }
    expect(props.pages).toEqual([
      { id: "p1", title: "Nouns", slug: "nouns", updatedAt },
      { id: "p2", title: "Verbs", slug: "verbs", updatedAt },
    ])
    expect(props.wordCountsById).toEqual({ p1: 3, p2: 0 })
  })

  it("loads only the edited page's document plus a title/slug list for wiki links", async () => {
    const tree = await EditGrammarPage({ params: Promise.resolve({ slug: "lingua", pageSlug: "nouns" }) })
    const editor = findElement(tree, GrammarEditor)
    expect(editor).not.toBeNull()
    const props = editor!.props as { page: { id: string; content: unknown; updatedAt: Date }; grammarPages: unknown[]; symbols: unknown[] }
    expect(props.page).toMatchObject({ id: "p1", content: doc("three little words"), updatedAt })
    expect(props.grammarPages).toEqual([{ id: "p2", title: "Verbs", slug: "verbs" }])
    expect(props.symbols).toEqual([{ id: "s1", symbol: "a", ipa: "a", latin: "a", name: null, order: 0 }])
    expect(mocks.findPage).toHaveBeenCalledWith(expect.objectContaining({ where: { languageId_slug: { languageId: "lang-1", slug: "nouns" } } }))
    for (const [query] of mocks.findLanguage.mock.calls) expect(query.select.grammarPages).toBeUndefined()
  })

  it("returns not found for an unknown page slug", async () => {
    await expect(EditGrammarPage({ params: Promise.resolve({ slug: "lingua", pageSlug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
