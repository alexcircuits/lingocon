import { act, fireEvent, render, screen } from "@testing-library/react"
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
vi.mock("@/app/actions/text", () => ({ updateText: mocks.update, createText: mocks.create, deleteText: mocks.remove }))
// The live editor is replaced by a stub that hands over an editor whose document is `mocks.document`.
vi.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({ onEditorReady }: { onEditorReady?: (editor: unknown) => void }) => {
    onEditorReady?.({ getJSON: () => mocks.document })
    return <div data-testid="rich-text" />
  },
}))
vi.mock("@/components/paradigm-insert-dialog", () => ({ ParadigmInsertDialog: () => null }))
vi.mock("@/components/paradigm-selector", () => ({
  ParadigmSelector: ({ value, onValueChange, disabled }: { value?: string | null; onValueChange: (value: string | null) => void; disabled?: boolean }) => (
    <div data-testid="paradigm-selector" data-disabled={String(Boolean(disabled))}>
      {value ? <button type="button" onClick={() => onValueChange(null)}>clear paradigm</button> : <span>no paradigm</span>}
    </div>
  ),
}))
vi.mock("@/components/ui/file-upload", () => ({
  FileUpload: ({ value, onChange }: { value?: string; onChange: (url: string | null) => void }) =>
    value ? <button type="button" onClick={() => onChange(null)}>remove cover</button> : <span>no cover</span>,
}))
import { TextEditor } from "../text-editor"

const loadedAt = new Date("2026-01-01T00:00:00.000Z")
const savedAt = new Date("2026-01-02T00:00:00.000Z")
const text = {
  id: "text-1", title: "Old title", slug: "old-title", content: JSON.stringify({ type: "doc", content: [] }),
  published: true, coverImage: "https://example.test/cover.png", paradigmId: "paradigm-1", updatedAt: loadedAt,
}
const saved = (overrides: Record<string, unknown> = {}) =>
  ({ text: { ...text, content: { type: "doc", content: [] }, updatedAt: savedAt, ...overrides } })

function renderEditor(props: Partial<typeof text> = {}) {
  render(<TextEditor languageId="lang-1" languageSlug="lingua" text={{ ...text, ...props }} />)
}
async function submit(name = "saveChanges") {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name })) })
}

beforeEach(() => { vi.clearAllMocks() })

describe("text editor saves", () => {
  it("moves to the server-assigned URL after a rename instead of refreshing the stale one", async () => {
    mocks.update.mockResolvedValue(saved({ title: "Renamed", slug: "renamed" }))
    renderEditor()
    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "Renamed" } })
    await submit()
    expect(mocks.replace).toHaveBeenCalledWith("/studio/lang/lingua/texts/renamed")
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

  it("does not offer a Draft switch that saving would ignore", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor({ published: false })
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.getByText("alwaysPublishedHint")).toBeInTheDocument()
    await submit()
    expect(mocks.update.mock.lastCall![1]).not.toHaveProperty("published")
  })

  it("sends null when the paradigm is cleared so the server unlinks it, and adopts the saved value", async () => {
    mocks.update.mockResolvedValue(saved({ paradigmId: null }))
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "clear paradigm" }))
    await submit()
    expect(mocks.update).toHaveBeenCalledWith("text-1", expect.objectContaining({ paradigmId: null }))
    expect(screen.getByText("no paradigm")).toBeInTheDocument()
  })

  it("sends null when the cover image is removed so the server clears it", async () => {
    mocks.update.mockResolvedValue(saved({ coverImage: null }))
    renderEditor()
    fireEvent.click(screen.getByRole("button", { name: "remove cover" }))
    await submit()
    expect(mocks.update).toHaveBeenCalledWith("text-1", expect.objectContaining({ coverImage: null }))
    expect(screen.getByText("no cover")).toBeInTheDocument()
  })

  it("saves the editor's current document, read at save time", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.update).toHaveBeenCalledWith("text-1", expect.objectContaining({ content: mocks.document }))
  })

  it("sends the revision it loaded and adopts the saved revision for the next save", async () => {
    mocks.update.mockResolvedValue(saved())
    renderEditor()
    await submit()
    expect(mocks.update).toHaveBeenLastCalledWith("text-1", expect.objectContaining({ expectedUpdatedAt: loadedAt.toISOString() }))
    await submit()
    expect(mocks.update).toHaveBeenLastCalledWith("text-1", expect.objectContaining({ expectedUpdatedAt: savedAt.toISOString() }))
  })

  it("keeps the draft and offers a full reload of the latest version on a conflict", async () => {
    mocks.update.mockResolvedValue({ error: "This text changed since you opened it.", conflict: true })
    renderEditor()
    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "My unsaved draft" } })
    await submit()
    expect(screen.getByRole("alert")).toHaveTextContent("staleConflict")
    expect(screen.getByRole("link", { name: "reloadLatest" })).toHaveAttribute("href", "/studio/lang/lingua/texts/old-title")
    expect(screen.getByLabelText("titleLabel")).toHaveValue("My unsaved draft")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("creates a text from the editor's document and previews the generated slug", async () => {
    mocks.create.mockResolvedValue(saved())
    render(<TextEditor languageId="lang-1" languageSlug="lingua" />)
    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "Tōki Story" } })
    expect(screen.getByLabelText("slugLabel")).toHaveValue("toki-story")
    await submit("saveText")
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Tōki Story", languageId: "lang-1", content: mocks.document }))
    expect(mocks.push).toHaveBeenCalledWith("/studio/lang/lingua/texts")
  })
})

describe("text editor read-only", () => {
  it("shows the text without save, delete, cover upload or paradigm clearing", async () => {
    render(<TextEditor languageId="lang-1" languageSlug="lingua" text={text} readOnly />)
    expect(screen.queryByRole("button", { name: "saveChanges" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "deleteText" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "remove cover" })).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "coverImage" })).toHaveAttribute("src", text.coverImage)
    expect(screen.getByLabelText("titleLabel")).toHaveAttribute("readonly")
    expect(screen.getByTestId("paradigm-selector")).toHaveAttribute("data-disabled", "true")
    await act(async () => { fireEvent.submit(screen.getByLabelText("titleLabel").closest("form")!) })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
