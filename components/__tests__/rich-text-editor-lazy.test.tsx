import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ wikiLinkDialogLoads: 0, ipaChartLoads: 0 }))

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
// Node views load embeds backed by server actions; the loading boundaries are what is under test.
vi.mock("@/lib/tiptap/paradigm-node-view", () => ({ ParadigmNodeView: () => null }))
vi.mock("@/lib/tiptap/igt-node-view", () => ({ IGTNodeView: () => null }))
// Counts module evaluations: a code-split dialog's module is evaluated when its chunk loads.
vi.mock("@/components/wiki-link-dialog", () => {
  mocks.wikiLinkDialogLoads++
  return { WikiLinkDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">wiki links</div> : null) }
})
vi.mock("@/components/ipa-chart-generator", () => {
  mocks.ipaChartLoads++
  return { IpaChartGenerator: ({ open }: { open: boolean }) => (open ? <div role="dialog">ipa chart</div> : null) }
})
import { RichTextEditor } from "../rich-text-editor"

const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] }

// Compiling the editor engine on first import can outlast waitFor's default timeout on a busy
// machine; warm it up front. The dynamic boundary still starts in its loading state on render.
beforeAll(async () => { await import("@/components/rich-text/rich-text-editor-impl") }, 30_000)

describe("code-split rich text editor", () => {
  it("holds the editor's place with a busy frame until the editor chunk has loaded", async () => {
    const { container } = render(<RichTextEditor content={doc} />)
    // Not interactive yet: a frame with the editor's footprint, marked busy for assistive tech.
    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument()
    expect(container.querySelector(".ProseMirror")).toBeNull()

    await waitFor(() => expect(container.querySelector(".ProseMirror")).toHaveTextContent("hello"), { timeout: 5_000 })
    expect(container.querySelector("[aria-busy='true']")).toBeNull()
    expect(screen.getByRole("button", { name: "bold" })).toBeInTheDocument()
  })

  it("loads the wiki-link and IPA chart dialogs only when they are first opened", async () => {
    const { container } = render(
      <RichTextEditor content={doc} withWikiLinks withIpaChart languageSlug="lingua" grammarPages={[]} symbols={[]} />
    )
    await waitFor(() => expect(container.querySelector(".ProseMirror")).not.toBeNull(), { timeout: 5_000 })
    expect(mocks.wikiLinkDialogLoads).toBe(0)
    expect(mocks.ipaChartLoads).toBe(0)

    await act(async () => { fireEvent.click(screen.getByTitle("insertWikiLink")) })
    expect(await screen.findByRole("dialog", undefined, { timeout: 5_000 })).toHaveTextContent("wiki links")
    expect(mocks.wikiLinkDialogLoads).toBe(1)
    expect(mocks.ipaChartLoads).toBe(0)

    await act(async () => { fireEvent.click(screen.getByTitle("generateIpaChart")) })
    expect(await screen.findByText("ipa chart", undefined, { timeout: 5_000 })).toBeInTheDocument()
    expect(mocks.ipaChartLoads).toBe(1)
  })
})
