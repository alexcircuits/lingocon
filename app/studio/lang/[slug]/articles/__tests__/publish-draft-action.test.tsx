import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isValidElement, type ReactElement, type ReactNode } from "react"

const mocks = vi.hoisted(() => ({
  publishArticle: vi.fn(),
  redirect: vi.fn(),
  findLanguage: vi.fn(),
}))
vi.mock("@/app/actions/article", () => ({ publishArticle: mocks.publishArticle }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { language: { findUnique: mocks.findLanguage } } }))
vi.mock("@/lib/auth-helpers", () => ({
  getUserId: vi.fn(async () => "editor"),
  canEditScope: vi.fn(async () => true),
  canViewLanguage: vi.fn(async () => true),
}))
vi.mock("@/lib/services/article", () => ({ getDraftArticles: vi.fn(async () => [draft]) }))
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const author = { id: "author", name: "Author", image: null }
const draft = { id: "draft-1", title: "Draft Title", slug: "draft-title", published: false, createdAt: new Date(), authorId: "author", author }

import ArticlesPage from "../page"

type PageProps = Parameters<typeof ArticlesPage>[0]

async function renderPage(searchParams: Record<string, string> = {}): Promise<ReactElement> {
  const props = { params: Promise.resolve({ slug: "lang" }), searchParams: Promise.resolve(searchParams) }
  return ArticlesPage(props as unknown as PageProps) as Promise<ReactElement>
}

/** Find the first host element of `type` in an unrendered server component tree. */
function findElement(node: ReactNode, type: string): ReactElement | null {
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

/** Submit the draft's publish form the way a browser would: with its hidden fields. */
async function submitPublishForm(tree: ReactElement) {
  const form = findElement(tree, "form")
  expect(form).not.toBeNull()
  const props = form!.props as { action: (data: FormData) => Promise<void>; children: ReactNode }
  const data = new FormData()
  const collect = (node: ReactNode): void => {
    if (Array.isArray(node)) return node.forEach(collect)
    if (!isValidElement(node)) return
    const p = node.props as { type?: string; name?: string; value?: string; children?: ReactNode }
    if (node.type === "input" && p.type === "hidden" && p.name) data.append(p.name, String(p.value))
    collect(p.children)
  }
  collect(props.children)
  await props.action(data)
}

function redirectTarget(): URL {
  expect(mocks.redirect).toHaveBeenCalledTimes(1)
  return new URL(mocks.redirect.mock.calls[0][0], "http://app.test")
}

beforeEach(() => {
  mocks.findLanguage.mockResolvedValue({ id: "lang-id", name: "Lang", slug: "lang", ownerId: "owner", articles: [draft] })
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("publishing a pending draft from the articles list", () => {
  it("carries a permission failure back to the list as a fixed code, not the raw message", async () => {
    mocks.publishArticle.mockResolvedValue({ error: "You don't have permission to publish articles" })
    await submitPublishForm(await renderPage())
    expect(mocks.publishArticle).toHaveBeenCalledWith("draft-1")
    const target = redirectTarget()
    expect(target.pathname).toBe("/studio/lang/lang/articles")
    expect(target.searchParams.get("draft")).toBe("draft-1")
    expect(target.searchParams.get("publishError")).toBe("forbidden")
  })

  it("reports a thrown publish as a generic failure", async () => {
    mocks.publishArticle.mockRejectedValue(new Error("connection reset"))
    await submitPublishForm(await renderPage())
    expect(redirectTarget().searchParams.get("publishError")).toBe("failed")
  })

  it("returns to the clean list after a successful publish", async () => {
    mocks.publishArticle.mockResolvedValue({ article: { id: "draft-1" } })
    await submitPublishForm(await renderPage({ draft: "draft-1", publishError: "failed" }))
    expect(mocks.redirect).toHaveBeenCalledWith("/studio/lang/lang/articles")
  })

  it("shows a localized reason next to the draft that could not be published", async () => {
    render(await renderPage({ draft: "draft-1", publishError: "forbidden" }))
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent('publishFailedTitle:{"title":"Draft Title"}')
    expect(alert).toHaveTextContent("publishFailedForbidden")
  })

  it("never renders text taken from the URL", async () => {
    render(await renderPage({ draft: "draft-1", publishError: "Your account is locked, call +1-555-0100" }))
    expect(screen.queryByText(/call \+1-555-0100/)).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("publishFailedGeneric")
  })

  it("ignores a failure notice for a draft that is not pending in this language", async () => {
    render(await renderPage({ draft: "someone-elses-draft", publishError: "forbidden" }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
