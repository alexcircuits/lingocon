import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  update: vi.fn(), create: vi.fn(), remove: vi.fn(),
  replace: vi.fn(), refresh: vi.fn(), push: vi.fn(),
  success: vi.fn(), error: vi.fn(),
  document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "typed" }] }] },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: mocks.push }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock("@/app/actions/article", () => ({ updateArticle: mocks.update, createArticle: mocks.create, deleteArticle: mocks.remove }))
// The live editor is replaced by a stub that hands over an editor whose document is `mocks.document`.
vi.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({ onEditorReady, disabled }: { onEditorReady?: (editor: unknown) => void; disabled?: boolean }) => {
    onEditorReady?.({ getJSON: () => mocks.document, on: () => {} })
    return <div data-testid="rich-text" data-disabled={String(Boolean(disabled))} />
  },
}))
vi.mock("@/components/paradigm-insert-dialog", () => ({ ParadigmInsertDialog: () => null }))
vi.mock("@/components/ui/file-upload", () => ({
  FileUpload: ({ value, onChange }: { value?: string; onChange: (url: string | null) => void }) =>
    value ? <button type="button" onClick={() => onChange(null)}>remove cover</button> : <span>no cover</span>,
}))
import { ArticleEditor } from "../article-editor"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }
const visitor = (permissions: string[]): Access => ({ isOwner: false, fullAccess: false, permissions })

const loadedAt = new Date("2026-01-01T00:00:00.000Z")
const savedAt = new Date("2026-01-02T00:00:00.000Z")
const article = {
  id: "article-1", title: "Old title", slug: "old-title", content: { type: "doc", content: [] },
  coverImage: "https://example.test/cover.png", paradigmId: null, published: true, updatedAt: loadedAt,
}
const saved = (overrides: Record<string, unknown> = {}) => ({ article: { ...article, updatedAt: savedAt, ...overrides } })

function renderEditor() {
  render(<ArticleEditor languageId="lang-1" languageSlug="lingua" article={article} />)
}
async function submit(name = "saveChanges") {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name })) })
}

beforeEach(() => { vi.clearAllMocks() })

describe("article editor saves", () => {
  it("moves to the server-assigned URL after a rename instead of refreshing the stale one", async () => {
    mocks.update.mockResolvedValue(saved({ title: "Renamed", slug: "renamed" }))
    renderEditor()
    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "Renamed" } })
    await submit()
    expect(mocks.replace).toHaveBeenCalledWith("/studio/lang/lingua/articles/renamed")
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByLabelText("slugLabel")).toHaveValue("renamed")
  })

  it("relies on the action's revalidation instead of a second refresh when the URL is unchanged", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.success).toHaveBeenCalledWith("updatedToast")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("shows the slug as server-generated instead of an input the server ignores", () => {
    renderEditor()
    expect(screen.getByLabelText("slugLabel")).toHaveAttribute("readonly")
    expect(screen.getByText("slugGeneratedHint")).toBeInTheDocument()
  })

  it("sends null when the cover image is removed so the server clears it, and adopts the saved value", async () => {
    mocks.update.mockResolvedValue(saved({ coverImage: null }))
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "remove cover" }))
    await submit()
    expect(mocks.update).toHaveBeenCalledWith("article-1", expect.objectContaining({ coverImage: null }))
    expect(screen.getByText("no cover")).toBeInTheDocument()
  })

  it("saves the editor's current document, read at save time", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.update).toHaveBeenCalledWith("article-1", expect.objectContaining({ content: mocks.document }))
  })

  it("sends the revision it loaded and adopts the saved revision for the next save", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.update).toHaveBeenLastCalledWith("article-1", expect.objectContaining({ expectedUpdatedAt: loadedAt.toISOString() }))
    await submit()
    expect(mocks.update).toHaveBeenLastCalledWith("article-1", expect.objectContaining({ expectedUpdatedAt: savedAt.toISOString() }))
  })

  it("keeps the draft and offers a full reload of the latest version on a conflict", async () => {
    mocks.update.mockResolvedValue({ error: "This article changed since you opened it.", conflict: true })
    renderEditor()
    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "My unsaved draft" } })
    await submit()
    expect(screen.getByRole("alert")).toHaveTextContent("staleConflict")
    expect(screen.getByRole("link", { name: "reloadLatest" })).toHaveAttribute("href", "/studio/lang/lingua/articles/old-title")
    expect(screen.getByLabelText("titleLabel")).toHaveValue("My unsaved draft")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("creates an article from the editor's document and previews the generated slug", async () => {
    mocks.create.mockResolvedValue(saved())
    render(<ArticleEditor languageId="lang-1" languageSlug="lingua" />)
    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "Ëlvish News" } })
    expect(screen.getByLabelText("slugLabel")).toHaveValue("elvish-news")
    await submit("saveArticle")
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Ëlvish News", languageId: "lang-1", content: mocks.document }))
    expect(mocks.push).toHaveBeenCalledWith("/studio/lang/lingua/articles")
  })
})

describe("article editor access", () => {
  it("shows a read-only article without save, delete, publish or cover upload", async () => {
    render(<ArticleEditor languageId="lang-1" languageSlug="lingua" article={article} readOnly />, {
      wrapper: withAccess(visitor([])),
    })
    expect(screen.queryByRole("button", { name: "saveChanges" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "deleteArticle" })).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "remove cover" })).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "coverImage" })).toHaveAttribute("src", article.coverImage)
    expect(screen.getByLabelText("titleLabel")).toHaveAttribute("readonly")
    expect(screen.getByTestId("rich-text")).toHaveAttribute("data-disabled", "true")
    await act(async () => { fireEvent.submit(screen.getByLabelText("titleLabel").closest("form")!) })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("lets a draft contributor save a draft but offers no publish switch the server would ignore", () => {
    render(<ArticleEditor languageId="lang-1" languageSlug="lingua" />, { wrapper: withAccess(visitor(["draft:articles"])) })
    expect(screen.getByRole("button", { name: "saveArticle" })).toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.getByText("draft")).toBeInTheDocument()
  })

  it("offers the publish switch to a collaborator with write:articles", () => {
    render(<ArticleEditor languageId="lang-1" languageSlug="lingua" article={article} />, {
      wrapper: withAccess(visitor(["write:articles"])),
    })
    expect(screen.getByRole("switch", { name: "public" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "saveChanges" })).toBeInTheDocument()
  })
})
