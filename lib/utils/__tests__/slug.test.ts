import { describe, it, expect } from "vitest"
import { generateSlug } from "../slug"

describe("generateSlug", () => {
  it("converts to lowercase", () => {
    expect(generateSlug("Hello World")).toBe("hello-world")
  })

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("my new language")).toBe("my-new-language")
  })

  it("replaces underscores with hyphens", () => {
    expect(generateSlug("my_new_language")).toBe("my-new-language")
  })

  it("removes special characters", () => {
    expect(generateSlug("hello! @world #2024")).toBe("hello-world-2024")
  })

  it("collapses multiple hyphens", () => {
    expect(generateSlug("hello---world")).toBe("hello-world")
  })

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("-hello world-")).toBe("hello-world")
  })

  it("trims whitespace", () => {
    expect(generateSlug("  hello world  ")).toBe("hello-world")
  })

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("")
  })

  it("handles string with only special characters", () => {
    expect(generateSlug("!@#$%")).toBe("")
  })

  it("handles mixed spaces, underscores, and hyphens", () => {
    expect(generateSlug("hello - world _ foo")).toBe("hello-world-foo")
  })

  it("preserves numbers", () => {
    expect(generateSlug("language 42")).toBe("language-42")
  })

  it("handles single word", () => {
    expect(generateSlug("elvish")).toBe("elvish")
  })
})
