import { describe, it, expect } from "vitest"
import { headingId, extractHeadings } from "../tiptap-headings"

describe("headingId", () => {
  it("lowercases text", () => {
    expect(headingId("Hello World")).toBe("hello-world")
  })

  it("replaces spaces with hyphens", () => {
    expect(headingId("noun cases")).toBe("noun-cases")
  })

  it("removes special characters", () => {
    // "&" and "!" are stripped; the surrounding spaces collapse to one hyphen
    // (consistent with the "collapses multiple spaces" case below).
    expect(headingId("Verbs & Tenses!")).toBe("verbs-tenses")
  })

  it("collapses multiple spaces", () => {
    expect(headingId("a  b")).toBe("a-b")
  })

  it("handles empty string", () => {
    expect(headingId("")).toBe("")
  })
})

describe("extractHeadings", () => {
  it("returns empty array for null", () => {
    expect(extractHeadings(null)).toHaveLength(0)
  })

  it("returns empty array for non-object", () => {
    expect(extractHeadings("string")).toHaveLength(0)
  })

  it("returns empty array for document with no content array", () => {
    expect(extractHeadings({ type: "doc" })).toHaveLength(0)
  })

  it("extracts h1 headings", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Introduction" }],
        },
      ],
    }
    const headings = extractHeadings(doc)
    expect(headings).toHaveLength(1)
    expect(headings[0].text).toBe("Introduction")
    expect(headings[0].level).toBe(1)
    expect(headings[0].id).toBe("introduction")
  })

  it("extracts h2 and h3 but not h4+", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Section" }] },
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Skip me" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Subsection" }] },
      ],
    }
    const headings = extractHeadings(doc)
    expect(headings).toHaveLength(2)
    expect(headings[0].level).toBe(2)
    expect(headings[1].level).toBe(3)
  })

  it("preserves document order", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A" }] },
        { type: "paragraph", content: [{ type: "text", text: "some text" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "B" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "C" }] },
      ],
    }
    const headings = extractHeadings(doc)
    expect(headings.map(h => h.text)).toEqual(["A", "B", "C"])
  })

  it("skips headings with empty text", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "   " }] },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Valid" }] },
      ],
    }
    const headings = extractHeadings(doc)
    expect(headings).toHaveLength(1)
    expect(headings[0].text).toBe("Valid")
  })

  it("generates unique ids from heading text", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Noun Cases" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Verb Tenses" }] },
      ],
    }
    const headings = extractHeadings(doc)
    expect(headings[0].id).toBe("noun-cases")
    expect(headings[1].id).toBe("verb-tenses")
  })

  it("concatenates text from multiple inline nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "World" },
          ],
        },
      ],
    }
    const headings = extractHeadings(doc)
    expect(headings[0].text).toBe("Hello World")
  })
})
