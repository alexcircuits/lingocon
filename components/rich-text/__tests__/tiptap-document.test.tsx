import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/app/actions/paradigm", () => ({ getParadigmById: vi.fn(async () => ({ error: "x" })) }))

import { TiptapDocument, normalizeTiptapContent } from "../tiptap-document"

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Noun Cases" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Bold ", marks: [{ type: "bold" }] },
        { type: "text", text: "kareth", marks: [{ type: "customFont" }] },
        { type: "text", text: " see " },
        { type: "wikiLink", attrs: { slug: "verbs", label: "Verbs" } },
        { type: "text", text: " and " },
        { type: "text", text: "evil", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
      ],
    },
    {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2 }, content: [{ type: "paragraph", content: [{ type: "text", text: "Case" }] }] }] },
      ],
    },
    { type: "mysteryNode", content: [{ type: "text", text: "kept text" }] },
  ],
}

describe("TiptapDocument", () => {
  it("renders headings with the ids the table of contents links to", () => {
    render(<TiptapDocument content={doc} languageSlug="elvish" />)
    expect(screen.getByRole("heading", { level: 2, name: "Noun Cases" }).id).toBe("noun-cases")
  })

  it("renders marks, custom-script spans and wiki links", () => {
    render(<TiptapDocument content={doc} languageSlug="elvish" />)
    expect(screen.getByText("Bold").tagName).toBe("STRONG")
    expect(screen.getByText("kareth")).toHaveClass("font-custom-script")
    expect(screen.getByRole("link", { name: "Verbs" })).toHaveAttribute("href", "/lang/elvish/grammar/verbs")
  })

  it("drops unsafe link hrefs but keeps the text", () => {
    const { container } = render(<TiptapDocument content={doc} />)
    expect(container.querySelector('a[href^="javascript"]')).toBeNull()
    expect(container.textContent).toContain("and evil")
  })

  it("keeps table spans and text inside unknown nodes", () => {
    render(<TiptapDocument content={doc} />)
    expect(screen.getByRole("columnheader", { name: "Case" })).toHaveAttribute("colspan", "2")
    expect(screen.getByText("kept text")).toBeInTheDocument()
  })

  it("normalizes legacy plain-string and malformed content", () => {
    expect(normalizeTiptapContent("line one\n\nline two").content).toHaveLength(2)
    expect(normalizeTiptapContent(null)).toEqual({ type: "doc", content: [] })
  })
})
