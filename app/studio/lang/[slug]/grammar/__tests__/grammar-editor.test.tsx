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
vi.mock("@/app/actions/grammar-page", () => ({
  updateGrammarPage: mocks.update, createGrammarPage: mocks.create, deleteGrammarPage: mocks.remove,
}))
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
import { GrammarEditor } from "../grammar-editor"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const owner: Access = { isOwner: true, fullAccess: true, permissions: [] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

const loadedAt = new Date("2026-01-01T00:00:00.000Z")
const savedAt = new Date("2026-01-02T00:00:00.000Z")
const page = {
  id: "page-1", title: "Cases", slug: "cases", content: { type: "doc", content: [] },
  imageUrl: "https://example.test/cover.png" as string | null, order: 0, paradigmId: null, languageId: "lang-1",
  createdAt: loadedAt, updatedAt: loadedAt,
}
const saved = (overrides: Partial<typeof page> = {}) =>
  ({ success: true as const, data: { ...page, language: { slug: "lingua" }, updatedAt: savedAt, ...overrides } })

function renderEditor(access: Access = owner) {
  render(<GrammarEditor languageId="lang-1" languageSlug="lingua" page={page} />, { wrapper: withAccess(access) })
}
async function submit(name = "updatePage") {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name })) })
}

beforeEach(() => { vi.clearAllMocks() })

describe("grammar editor saves", () => {
  it("moves to the new URL after a slug change instead of refreshing the stale one", async () => {
    mocks.update.mockResolvedValue(saved({ slug: "noun-cases" }))
    renderEditor()
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "noun-cases" } })
    await submit()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ slug: "noun-cases" }))
    expect(mocks.replace).toHaveBeenCalledWith("/studio/lang/lingua/grammar/noun-cases")
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("relies on the action's revalidation instead of a second refresh when the URL is unchanged", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.success).toHaveBeenCalledWith("updatedToast")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("sends null when the cover image is removed so the server clears it, and adopts the saved value", async () => {
    mocks.update.mockResolvedValue(saved({ imageUrl: null }))
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "remove cover" }))
    await submit()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }))
    expect(screen.getByText("no cover")).toBeInTheDocument()
  })

  it("saves the editor's current document, read at save time", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ content: mocks.document }))
  })

  it("sends the revision it loaded and adopts the saved revision for the next save", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: loadedAt.toISOString() }))
    await submit()
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: savedAt.toISOString() }))
  })

  it("keeps the draft and offers a full reload of the latest version on a conflict", async () => {
    mocks.update.mockResolvedValue({ error: "This grammar page changed since you opened it.", conflict: true })
    renderEditor()
    fireEvent.change(screen.getByLabelText("title"), { target: { value: "My unsaved draft" } })
    await submit()
    expect(screen.getByRole("alert")).toHaveTextContent("staleConflict")
    expect(screen.getByRole("link", { name: "reloadLatest" })).toHaveAttribute("href", "/studio/lang/lingua/grammar/cases")
    expect(screen.getByLabelText("title")).toHaveValue("My unsaved draft")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("creates a page from the editor's document and returns to the list", async () => {
    mocks.create.mockResolvedValue(saved())
    render(<GrammarEditor languageId="lang-1" languageSlug="lingua" order={3} />, { wrapper: withAccess(owner) })
    fireEvent.change(screen.getByLabelText("title"), { target: { value: "Verbs" } })
    await submit("createPage")
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      title: "Verbs", slug: "verbs", order: 3, languageId: "lang-1", content: mocks.document,
    }))
    expect(mocks.push).toHaveBeenCalledWith("/studio/lang/lingua/grammar")
  })
})

describe("grammar editor for a visitor who may not edit grammar", () => {
  it("shows the page read-only and offers no save, delete or cover upload", () => {
    renderEditor({ isOwner: false, fullAccess: false, permissions: ["write:dictionary"] })
    expect(screen.queryByRole("button", { name: "updatePage" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "deletePage" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("title")).toHaveAttribute("readonly")
    expect(screen.getByLabelText("slug")).toHaveAttribute("readonly")
    expect(screen.getByTestId("rich-text")).toHaveAttribute("data-disabled", "true")
    // The stored cover is shown, but not the upload field that could replace or remove it.
    expect(screen.queryByRole("button", { name: "remove cover" })).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "coverImage" })).toHaveAttribute("src", page.imageUrl)
  })

  it("offers saving to a collaborator with the grammar scope", () => {
    renderEditor({ isOwner: false, fullAccess: false, permissions: ["write:grammar"] })
    expect(screen.getByRole("button", { name: "updatePage" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "deletePage" })).toBeInTheDocument()
    expect(screen.getByLabelText("title")).not.toHaveAttribute("readonly")
    expect(screen.getByTestId("rich-text")).toHaveAttribute("data-disabled", "false")
  })
})
