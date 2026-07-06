import { describe, expect, it } from "vitest"
import { blankWholeWord, escapeRegExp } from "../cloze"

describe("blankWholeWord", () => {
  it("blanks a single whole-word occurrence of the lemma", () => {
    expect(blankWholeWord("I like the cat today.", "cat")).toBe("I like the ____ today.")
  })

  it("blanks EVERY occurrence so the answer never leaks (multi-occurrence)", () => {
    const result = blankWholeWord("the cat sees the cat", "cat")
    expect(result).toBe("the ____ sees the ____")
    // The answer must not survive anywhere in the blanked sentence.
    expect(/\bcat\b/i.test(result!)).toBe(false)
  })

  it("blanks all three occurrences", () => {
    expect(blankWholeWord("cat cat cat", "cat")).toBe("____ ____ ____")
  })

  it("returns null when the lemma does not appear", () => {
    expect(blankWholeWord("the dog runs", "cat")).toBeNull()
  })

  it("does NOT blank a substring inside a larger word", () => {
    // "cat" is inside "scatter" / "category" — must not be blanked, must return null.
    expect(blankWholeWord("scatter the category", "cat")).toBeNull()
  })

  it("does not blank the lemma when it is only a substring but blanks the real word", () => {
    // "cat" appears as a substring in "scatter" but also as a whole word — only the whole word is blanked.
    expect(blankWholeWord("scatter the cat", "cat")).toBe("scatter the ____")
  })

  it("handles the lemma at the start of the sentence", () => {
    expect(blankWholeWord("cat is here", "cat")).toBe("____ is here")
  })

  it("handles the lemma at the end of the sentence", () => {
    expect(blankWholeWord("here is the cat", "cat")).toBe("here is the ____")
  })

  it("handles the lemma before terminal punctuation", () => {
    expect(blankWholeWord("look, a cat!", "cat")).toBe("look, a ____!")
  })

  it("is case-insensitive", () => {
    expect(blankWholeWord("The Cat sat", "cat")).toBe("The ____ sat")
  })

  it("escapes regex-special characters in the lemma", () => {
    // A lemma containing regex metacharacters must be matched literally.
    expect(blankWholeWord("say a.b then stop", "a.b")).toBe("say ____ then stop")
    // And must NOT match a different string that the unescaped pattern would.
    expect(blankWholeWord("say axb then stop", "a.b")).toBeNull()
  })
})

describe("escapeRegExp", () => {
  it("escapes all regex metacharacters", () => {
    expect(escapeRegExp("a.b*c+")).toBe("a\\.b\\*c\\+")
  })

  it("leaves plain text unchanged", () => {
    expect(escapeRegExp("hello")).toBe("hello")
  })
})
