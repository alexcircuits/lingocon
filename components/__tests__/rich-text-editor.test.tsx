import { act, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor } from "@tiptap/core"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/components/ipa-chart-generator", () => ({ IpaChartGenerator: () => null }))
vi.mock("@/components/wiki-link-dialog", () => ({ WikiLinkDialog: () => null }))
// Node views load embeds backed by server actions; the editor core is what is under test.
vi.mock("@/lib/tiptap/paradigm-node-view", () => ({ ParadigmNodeView: () => null }))
vi.mock("@/lib/tiptap/igt-node-view", () => ({ IGTNodeView: () => null }))
// The editor itself; its code-split entry point is covered by rich-text-editor-lazy.test.tsx.
import { RichTextEditor } from "../rich-text/rich-text-editor-impl"

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
const editable = () => document.querySelector(".ProseMirror") as HTMLElement | null

async function mountedEditor(ready: ReturnType<typeof vi.fn>): Promise<Editor> {
  await waitFor(() => expect(ready).toHaveBeenCalledWith(expect.any(Editor)))
  return ready.mock.lastCall![0] as Editor
}

afterEach(() => { vi.restoreAllMocks() })

describe("rich text editor", () => {
  it("does not reconfigure or reset the editor when its parent re-renders", async () => {
    const view = render(<RichTextEditor content={doc("original")} onEditorReady={() => undefined} withIGT withParadigm withWikiLinks languageSlug="lingua" />)
    await waitFor(() => expect(editable()).toHaveTextContent("original"))
    const setOptions = vi.spyOn(Editor.prototype, "setOptions")
    // A parent re-render passes fresh callbacks and, e.g. after a save, a fresh document object.
    for (const text of ["first re-render", "second re-render"]) {
      view.rerender(<RichTextEditor content={doc(text)} onEditorReady={() => undefined} withIGT withParadigm withWikiLinks languageSlug="lingua" />)
    }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
    expect(setOptions).not.toHaveBeenCalled()
    expect(editable()).toHaveTextContent("original")
  })

  it("hands the parent the live editor so the document is read on demand, not per keystroke", async () => {
    const ready = vi.fn()
    render(<RichTextEditor content={doc("original")} onEditorReady={ready} />)
    const editor = await mountedEditor(ready)
    const getJSON = vi.spyOn(editor, "getJSON")
    act(() => { editor.chain().focus("end").insertContent(" and more").run() })
    expect(getJSON).not.toHaveBeenCalled()
    expect(JSON.stringify(editor.getJSON())).toContain("original and more")
  })

  it("keeps toolbar state current from editor transactions", async () => {
    const ready = vi.fn()
    render(<RichTextEditor content={doc("text")} onEditorReady={ready} />)
    const editor = await mountedEditor(ready)
    const bold = () => document.querySelector("button[aria-label='bold']") as HTMLButtonElement
    expect(bold()).not.toHaveClass("bg-secondary")
    act(() => { editor.chain().selectAll().toggleBold().run() })
    await waitFor(() => expect(bold()).toHaveClass("bg-secondary"))
  })

  it("follows the disabled prop after mount", async () => {
    const ready = vi.fn()
    const view = render(<RichTextEditor content={doc("text")} onEditorReady={ready} />)
    const editor = await mountedEditor(ready)
    expect(editor.isEditable).toBe(true)
    view.rerender(<RichTextEditor content={doc("text")} onEditorReady={ready} disabled />)
    await waitFor(() => expect(editor.isEditable).toBe(false))
    view.rerender(<RichTextEditor content={doc("text")} onEditorReady={ready} />)
    await waitFor(() => expect(editor.isEditable).toBe(true))
  })
})
