import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/grammar-page", () => ({ deleteGrammarPage: vi.fn(), reorderGrammarPages: vi.fn() }))
import { GrammarPagesManager, NewGrammarPageButton } from "../grammar-pages-manager"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const readOnly: Access = { isOwner: false, fullAccess: false, permissions: [] }
const grammarEditor: Access = { isOwner: false, fullAccess: false, permissions: ["write:grammar"] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

const pages = [
  { id: "p1", title: "Nouns", slug: "nouns", updatedAt: new Date("2026-01-01T00:00:00.000Z") },
  { id: "p2", title: "Verbs", slug: "verbs", updatedAt: new Date("2026-01-01T00:00:00.000Z") },
]
const list = (pageList = pages) => (
  <>
    <NewGrammarPageButton languageSlug="lingua" />
    <GrammarPagesManager languageId="lang-1" languageSlug="lingua" pages={pageList} />
  </>
)

afterEach(cleanup)

describe("grammar page list access", () => {
  it("offers no create, reorder, edit or delete to a read-only visitor, but links each page for reading", () => {
    render(list(), { wrapper: withAccess(readOnly) })
    expect(screen.queryByRole("link", { name: "newPage" })).not.toBeInTheDocument()
    for (const name of ["moveUp", "moveDown", "editPage", "deletePage"]) {
      expect(screen.queryAllByRole("button", { name })).toHaveLength(0)
    }
    expect(screen.getAllByRole("link", { name: "Nouns" })[0]).toHaveAttribute("href", "/studio/lang/lingua/grammar/nouns")
  })

  it("has no create call to action in the empty state for a read-only visitor", () => {
    render(list([]), { wrapper: withAccess(readOnly) })
    expect(screen.getByText("emptyTitle")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "createPage" })).not.toBeInTheDocument()
  })

  it("offers every control to a collaborator with the grammar scope", () => {
    render(list(), { wrapper: withAccess(grammarEditor) })
    expect(screen.getByRole("link", { name: "newPage" })).toHaveAttribute("href", "/studio/lang/lingua/grammar/new")
    expect(screen.getAllByRole("button", { name: "deletePage" }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: "moveDown" }).length).toBeGreaterThan(0)
  })

  it("offers the empty-state create call to action to a grammar editor", () => {
    render(list([]), { wrapper: withAccess(grammarEditor) })
    expect(screen.getByRole("link", { name: "createPage" })).toHaveAttribute("href", "/studio/lang/lingua/grammar/new")
  })
})
