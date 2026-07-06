import { describe, it, expect } from "vitest"
import { parseSyllableStructure, buildPhonemeWeights, generateWords } from "../word-generator"

describe("parseSyllableStructure", () => {
  it("parses simple CV template", () => {
    const slots = parseSyllableStructure("CV")
    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({ type: "C", optional: false })
    expect(slots[1]).toEqual({ type: "V", optional: false })
  })

  it("parses optional slot with parentheses", () => {
    const slots = parseSyllableStructure("(C)V")
    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({ type: "C", optional: true })
    expect(slots[1]).toEqual({ type: "V", optional: false })
  })

  it("parses complex template (C)CV(C)", () => {
    const slots = parseSyllableStructure("(C)CV(C)")
    expect(slots).toHaveLength(4)
    expect(slots[0]).toEqual({ type: "C", optional: true })
    expect(slots[1]).toEqual({ type: "C", optional: false })
    expect(slots[2]).toEqual({ type: "V", optional: false })
    expect(slots[3]).toEqual({ type: "C", optional: true })
  })

  it("is case-insensitive", () => {
    const slots = parseSyllableStructure("cv")
    expect(slots[0].type).toBe("C")
    expect(slots[1].type).toBe("V")
  })

  it("ignores whitespace", () => {
    const slots = parseSyllableStructure("C V")
    expect(slots).toHaveLength(2)
  })

  it("returns empty array for empty string", () => {
    expect(parseSyllableStructure("")).toHaveLength(0)
  })

  it("skips unknown characters", () => {
    const slots = parseSyllableStructure("CXV")
    // X is unknown, should only get C and V
    expect(slots).toHaveLength(2)
    expect(slots[0].type).toBe("C")
    expect(slots[1].type).toBe("V")
  })
})

describe("buildPhonemeWeights", () => {
  const phonemes = ["p", "a", "t", "k", "i"]

  it("returns empty map for empty word list", () => {
    const weights = buildPhonemeWeights([], phonemes)
    expect(weights.size).toBe(0)
  })

  it("counts phoneme occurrences", () => {
    const weights = buildPhonemeWeights(["pata", "kati"], phonemes)
    expect(weights.get("a")).toBe(3)
    expect(weights.get("p")).toBe(1)
    expect(weights.get("k")).toBe(1)
    expect(weights.get("t")).toBe(2)
  })

  it("handles multi-character phonemes (greedy match)", () => {
    const phonemes2 = ["ts", "t", "s", "a"]
    const weights = buildPhonemeWeights(["tsa"], phonemes2)
    // Greedy: "ts" should match before "t"
    expect(weights.get("ts")).toBe(1)
    expect(weights.has("t")).toBe(false)
  })

  it("skips characters not in phoneme list", () => {
    const weights = buildPhonemeWeights(["xyz"], phonemes)
    expect(weights.size).toBe(0)
  })
})

describe("generateWords", () => {
  const baseOpts = {
    syllableStructure: "CV",
    consonants: ["p", "t", "k", "n", "m"],
    vowels: ["a", "e", "i", "o", "u"],
    minSyllables: 1,
    maxSyllables: 2,
    count: 10,
  }

  it("generates the requested number of words", () => {
    const words = generateWords(baseOpts)
    expect(words.length).toBeLessThanOrEqual(10)
    expect(words.length).toBeGreaterThan(0)
  })

  it("generates unique words", () => {
    const words = generateWords({ ...baseOpts, count: 20 })
    const unique = new Set(words)
    expect(unique.size).toBe(words.length)
  })

  it("avoids existing words", () => {
    const existing = new Set(["pa", "ta", "ka"])
    const words = generateWords({ ...baseOpts, existingWords: existing, count: 20 })
    for (const word of words) {
      expect(existing.has(word)).toBe(false)
    }
  })

  it("uses phoneme weights without crashing", () => {
    const weights = buildPhonemeWeights(["pata", "kani"], [...baseOpts.consonants, ...baseOpts.vowels])
    const words = generateWords({ ...baseOpts, phonemeWeights: weights })
    expect(words.length).toBeGreaterThan(0)
  })

  it("returns empty array when no phonemes available", () => {
    const words = generateWords({ ...baseOpts, consonants: [], vowels: [] })
    expect(words).toHaveLength(0)
  })

  it("respects syllable count range", () => {
    // All words with CVC structure, 2-2 syllables → length should be 4+
    const words = generateWords({
      syllableStructure: "CVC",
      consonants: ["p", "t"],
      vowels: ["a"],
      minSyllables: 2,
      maxSyllables: 2,
      count: 5,
    })
    for (const word of words) {
      expect(word.length).toBe(6) // CVC + CVC = 6 chars
    }
  })
})

describe("generateWords constraints", () => {
  const baseOpts = {
    syllableStructure: "CVC",
    consonants: ["n", "t", "k"],
    vowels: ["a", "e", "i"],
    minSyllables: 2,
    maxSyllables: 3,
    count: 20,
  }

  it("rejects words matching a forbidden pattern", () => {
    const words = generateWords({ ...baseOpts, rejectPatterns: ["nn"] })
    for (const word of words) {
      expect(word).not.toMatch(/nn/)
    }
  })

  it("never returns a word present in existingWords", () => {
    const existing = new Set(["nan", "tat", "kik", "nen", "tik", "kan"])
    const words = generateWords({ ...baseOpts, existingWords: existing, count: 20 })
    for (const word of words) {
      expect(existing.has(word)).toBe(false)
    }
  })

  it("terminates and returns an empty (or short) array when over-constrained", () => {
    const words = generateWords({ ...baseOpts, rejectPatterns: ["."], count: 10 })
    expect(words.length).toBe(0)
  })

  it("ignores invalid regex patterns and still generates words", () => {
    const words = generateWords({ ...baseOpts, rejectPatterns: ["["], count: 10 })
    expect(words.length).toBeGreaterThan(0)
  })
})
