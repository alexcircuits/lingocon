import { describe, it, expect } from "vitest"
import {
  romanize,
  levenshtein,
  stripDiacritics,
  normalizeForCompare,
  matchWithTolerance,
  isAnswerCorrect,
  type ScriptSymbol,
} from "../lesson-answer"

describe("levenshtein", () => {
  it("is 0 for equal strings", () => {
    expect(levenshtein("kara", "kara")).toBe(0)
  })
  it("counts single edits", () => {
    expect(levenshtein("kara", "kira")).toBe(1) // substitution
    expect(levenshtein("kara", "kaa")).toBe(1)  // deletion
    expect(levenshtein("kara", "karaa")).toBe(1) // insertion
  })
  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3)
    expect(levenshtein("abc", "")).toBe(3)
  })
})

describe("stripDiacritics / normalizeForCompare", () => {
  it("removes combining marks", () => {
    expect(stripDiacritics("ǎéü")).toBe("aeu")
    expect(stripDiacritics("Ār-tï")).toBe("Ar-ti")
  })
  it("normalizeForCompare lowercases, trims, and strips diacritics", () => {
    expect(normalizeForCompare("  Kára  ")).toBe("kara")
  })
})

describe("matchWithTolerance", () => {
  it("matches exactly (after normalization)", () => {
    expect(matchWithTolerance("Kara", "kára")).toBe(true)
  })
  it("rejects any typo for short words (≤4 chars → tolerance 0)", () => {
    expect(matchWithTolerance("kira", "kara")).toBe(false)
  })
  it("allows 1 typo for words of 5–8 chars", () => {
    expect(matchWithTolerance("velora", "velura")).toBe(true)  // 1 sub
    expect(matchWithTolerance("velxra", "velora")).toBe(true)
  })
  it("allows up to 2 typos for words longer than 8 chars", () => {
    expect(matchWithTolerance("konstantin", "konstemtin")).toBe(true)  // 2 edits → ok
    expect(matchWithTolerance("konstxnxix", "konstantin")).toBe(false) // 3 edits → too far
  })
})

describe("isAnswerCorrect", () => {
  it("accepts an exact answer ignoring case and surrounding space", () => {
    expect(isAnswerCorrect("  Kara ", "kara")).toBe(true)
  })
  it("accepts a near-miss within tolerance", () => {
    expect(isAnswerCorrect("velora", "velura")).toBe(true)
  })
  it("rejects a wrong short answer", () => {
    expect(isAnswerCorrect("kira", "kara")).toBe(false)
  })
  it("is diacritic-insensitive", () => {
    expect(isAnswerCorrect("aaa", "ããã")).toBe(true)
  })

  describe("romanized opt-in", () => {
    const symbols: ScriptSymbol[] = [
      { symbol: "ᚳ", latin: "k" },
      { symbol: "ᚪ", latin: "a" },
      { symbol: "ᚱ", latin: "r" },
    ]
    const target = "ᚳᚪᚱᚪ" // romanizes to "kara"

    it("accepts the romanized form when enabled", () => {
      expect(isAnswerCorrect("kara", target, { acceptRomanized: true, scriptSymbols: symbols })).toBe(true)
    })
    it("rejects the romanized form when not enabled", () => {
      expect(isAnswerCorrect("kara", target)).toBe(false)
    })
    it("rejects the romanized form when no symbols are provided", () => {
      expect(isAnswerCorrect("kara", target, { acceptRomanized: true, scriptSymbols: [] })).toBe(false)
    })
  })
})

describe("romanize", () => {
  it("maps symbols and passes through unmapped characters", () => {
    const symbols: ScriptSymbol[] = [
      { symbol: "ᚳ", latin: "k" },
      { symbol: "ᚪ", latin: "a" },
      { symbol: "x", latin: null }, // null latin is ignored
    ]
    expect(romanize("ᚳᚪx", symbols)).toBe("kax")
  })
})
