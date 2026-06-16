import { describe, it, expect } from "vitest"
import { extractText, documentToPlainText } from "../tiptap-text"

describe("extractText", () => {
  it("returns empty string for null", () => {
    expect(extractText(null)).toBe("")
  })

  it("returns empty string for non-object", () => {
    expect(extractText("string")).toBe("")
    expect(extractText(42)).toBe("")
  })

  it("extracts text from a text node", () => {
    expect(extractText({ type: "text", text: "hello" })).toBe("hello")
  })

  it("returns empty string for text node with no text", () => {
    expect(extractText({ type: "text" })).toBe("")
  })

  it("joins inline children without separator", () => {
    expect(
      extractText({
        type: "span",
        content: [
          { type: "text", text: "foo" },
          { type: "text", text: "bar" },
        ],
      })
    ).toBe("foobar")
  })

  it("joins block-level children with spaces", () => {
    expect(
      extractText({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "First" }] },
          { type: "paragraph", content: [{ type: "text", text: "Second" }] },
        ],
      })
    ).toBe("First Second")
  })

  it("handles deeply nested content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "item one" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "item two" }],
                },
              ],
            },
          ],
        },
      ],
    }
    const result = extractText(doc)
    expect(result).toContain("item one")
    expect(result).toContain("item two")
  })

  it("handles nodes with no content", () => {
    expect(extractText({ type: "paragraph" })).toBe("")
  })
})

describe("documentToPlainText", () => {
  it("collapses whitespace", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "  hello  " }] },
        { type: "paragraph", content: [{ type: "text", text: "  world  " }] },
      ],
    }
    const result = documentToPlainText(doc)
    // documentToPlainText collapses every whitespace run to a single space.
    expect(result).toBe("hello world")
  })

  it("trims leading and trailing whitespace", () => {
    expect(documentToPlainText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] })).toBe("hello")
  })

  it("returns empty string for empty document", () => {
    expect(documentToPlainText({ type: "doc", content: [] })).toBe("")
  })

  it("returns empty string for null", () => {
    expect(documentToPlainText(null)).toBe("")
  })
})
