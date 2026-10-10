// @vitest-environment node
import { isValidElement, type ReactElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findLanguage: vi.fn(), findText: vi.fn(), canEditScope: vi.fn(), canView: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { language: { findUnique: mocks.findLanguage }, text: { findUnique: mocks.findText } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getUserId: async () => "me", canEditScope: mocks.canEditScope, canViewLanguage: mocks.canView,
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`) },
  notFound: () => { throw new Error("notFound") },
}))
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
vi.mock("../text-editor", () => ({ TextEditor: function TextEditor() { return null } }))
import TextsPage from "../page"
import EditTextPage from "../[textSlug]/page"
import NewTextPage from "../new/page"
import { EmptyState } from "@/components/empty-state"

const text = {
  id: "t1", title: "Story", slug: "story", content: null, published: true, coverImage: null, paradigmId: null,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}
function grant(...scopes: string[]) {
  mocks.canEditScope.mockImplementation(async (_language: string, _user: string, scope: string) => scopes.includes(scope))
}
/** Every element in a server-rendered tree (components are not rendered, only walked). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  const element = node as ReactElement<Record<string, unknown>>
  return [element, ...elements(element.props.children as ReactNode)]
}
const addLinks = (tree: ReactNode) => elements(tree).filter((el) => el.props.href === "/studio/lang/lingua/texts/new")
const params = { params: Promise.resolve({ slug: "lingua", textSlug: "story" }) }

beforeEach(() => {
  vi.resetAllMocks()
  process.env.DEV_MODE = "false"
  mocks.findLanguage.mockResolvedValue({ id: "lang-1", name: "Lingua", slug: "lingua", ownerId: "owner", texts: [] })
  mocks.findText.mockResolvedValue(text)
  mocks.canView.mockResolvedValue(true)
  grant()
})

describe("studio text pages access", () => {
  it("offers no add-text control, in the header or the empty state, to a visitor without write:texts", async () => {
    grant("draft:texts")
    const tree = await TextsPage({ params: Promise.resolve({ slug: "lingua" }) })
    expect(addLinks(tree)).toHaveLength(0)
    expect(elements(tree).find((el) => el.type === EmptyState)?.props.action).toBeUndefined()
  })

  it("offers adding a text to a collaborator with write:texts", async () => {
    grant("write:texts")
    const tree = await TextsPage({ params: Promise.resolve({ slug: "lingua" }) })
    expect(addLinks(tree)).toHaveLength(1)
    expect(elements(tree).find((el) => el.type === EmptyState)?.props.action).toMatchObject({ href: "/studio/lang/lingua/texts/new" })
  })

  it("opens a text read-only for a viewer, and for a draft:texts contributor whose saves the server refuses", async () => {
    expect(((await EditTextPage(params)) as ReactElement<{ readOnly: boolean }>).props.readOnly).toBe(true)
    grant("draft:texts")
    expect(((await EditTextPage(params)) as ReactElement<{ readOnly: boolean }>).props.readOnly).toBe(true)
  })

  it("opens a text for editing with write:texts", async () => {
    grant("write:texts")
    expect(((await EditTextPage(params)) as ReactElement<{ readOnly: boolean }>).props.readOnly).toBe(false)
  })

  it("reads no text for someone who cannot view the project", async () => {
    mocks.canView.mockResolvedValue(false)
    await expect(EditTextPage(params)).rejects.toThrow("notFound")
    expect(mocks.findText).not.toHaveBeenCalled()
  })

  it("offers the new-text form only with write:texts", async () => {
    grant("draft:texts")
    await expect(NewTextPage({ params: Promise.resolve({ slug: "lingua" }) })).rejects.toThrow("notFound")
    grant("write:texts")
    await expect(NewTextPage({ params: Promise.resolve({ slug: "lingua" }) })).resolves.toBeTruthy()
  })
})
