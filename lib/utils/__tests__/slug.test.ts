import { describe, it, expect } from "vitest"
import { generateSlug, slugOrFallback } from "../slug"

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

  it("drops apostrophes rather than splitting the word", () => {
    expect(generateSlug("Tolkien's Ka’ahi")).toBe("tolkiens-kaahi")
  })

  it("preserves numbers", () => {
    expect(generateSlug("language 42")).toBe("language-42")
  })

  it("handles single word", () => {
    expect(generateSlug("elvish")).toBe("elvish")
  })
})

describe("generateSlug — non-ASCII names", () => {
  it("folds Latin diacritics instead of dropping the letter", () => {
    expect(generateSlug("Ëlvish Tōngue")).toBe("elvish-tongue")
    expect(generateSlug("Ñandú çava")).toBe("nandu-cava")
  })

  it("transliterates letters that have no decomposition", () => {
    expect(generateSlug("Straße Æsir Øre Łódź Þing")).toBe("strasse-aesir-ore-lodz-thing")
  })

  it("transliterates Cyrillic", () => {
    expect(generateSlug("Бретонский язык")).toBe("bretonskii-yazyk")
    expect(generateSlug("Українська мова")).toBe("ukrainska-mova")
    expect(generateSlug("Щука й ёж")).toBe("shchuka-i-ezh")
  })

  it("transliterates Greek", () => {
    expect(generateSlug("Ελληνικά")).toBe("ellinika")
  })

  it("returns an empty slug when nothing is transliterable", () => {
    expect(generateSlug("ꯃꯤꯇꯩ 日本")).toBe("")
  })

  it("caps the length without leaving a trailing hyphen", () => {
    expect(generateSlug("abcd efgh", 5)).toBe("abcd")
    expect(generateSlug("a".repeat(150))).toHaveLength(100)
  })
})

describe("slugOrFallback", () => {
  it("uses the generated slug when there is one", () => {
    expect(slugOrFallback("Hello World", "text")).toBe("hello-world")
  })

  it("falls back when the title has no slug-able characters", () => {
    expect(slugOrFallback("日本", "text")).toBe("text")
    expect(slugOrFallback("", "article")).toBe("article")
  })
})
