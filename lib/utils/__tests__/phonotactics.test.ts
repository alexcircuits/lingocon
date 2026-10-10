import { describe, expect, it } from "vitest"
import { validatePhonotactics } from "@/lib/utils/alphabet-validation"
import { parseSyllableStructure } from "@/lib/utils/word-generator"

/**
 * The previous implementation, kept verbatim as the reference: one regex
 * `^(syllable)+$` built from alternations. Correct, but exponential on words that
 * do not fit (nested optional groups backtrack), and it runs on the server for
 * every dictionary save.
 */
function legacyValidatePhonotactics(
  str: string,
  syllableStructure?: string | null,
  consonants?: string[] | null,
  vowels?: string[] | null
): boolean {
  if (!str || !syllableStructure || !consonants?.length || !vowels?.length) return true
  const sortedC = [...consonants].sort((a, b) => b.length - a.length).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const sortedV = [...vowels].sort((a, b) => b.length - a.length).map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const cGroup = `(${sortedC.join("|")})`
  const vGroup = `(${sortedV.join("|")})`
  const slots = parseSyllableStructure(syllableStructure)
  if (slots.length === 0) return true
  let syllableRegexStr = ""
  for (const slot of slots) {
    if (slot.type === "C") syllableRegexStr += cGroup + (slot.optional ? "?" : "")
    else if (slot.type === "V") syllableRegexStr += vGroup + (slot.optional ? "?" : "")
  }
  const wordRegex = new RegExp(`^(${syllableRegexStr})+$`, "i")
  const cleanStr = str.replace(/[\s\d\p{P}\p{S}]+/gu, "")
  if (!cleanStr) return true
  return wordRegex.test(cleanStr)
}

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const STRUCTURES = ["CV", "(C)V", "CV(C)", "(C)V(C)", "(C)(C)V(C)(C)", "CCV", "V", "(C)(V)", "CVC(V)", "(c)v(c)", "C V", "X", ""]
const INVENTORIES: { consonants: string[]; vowels: string[] }[] = [
  { consonants: ["p", "t", "k", "s", "m", "n"], vowels: ["a", "e", "i", "o", "u"] },
  { consonants: ["sh", "s", "h", "ch", "c", "tʃ", "t"], vowels: ["a", "aa", "ai", "i"] },
  { consonants: ["P", "T", "Ñ", "ŋ", "ɣ"], vowels: ["A", "É", "ɛ", "ə"] },
  { consonants: ["k", "kʷ", "q", "ʔ", "."], vowels: ["a", "a:", "ə"] },
  { consonants: ["s", ""], vowels: ["a"] },
]
const EXTRA_CHARS = ["x", "z", "-", " ", "1", "!", "Á", "É", "é", "SH", "Ch", "ʃ", "😀", "́"]

describe("validatePhonotactics", () => {
  it("returns exactly what the previous regex implementation returned", () => {
    const next = rng(20261010)
    let checked = 0
    for (const structure of STRUCTURES) {
      for (const { consonants, vowels } of INVENTORIES) {
        const pool = [...consonants, ...vowels, ...EXTRA_CHARS].filter(Boolean)
        for (let n = 0; n < 120; n++) {
          // Short words keep the exponential reference fast.
          const length = 1 + Math.floor(next() * 6)
          let word = ""
          for (let i = 0; i < length; i++) {
            const piece = pool[Math.floor(next() * pool.length)]
            word += next() < 0.2 ? piece.toUpperCase() : piece
          }
          const expected = legacyValidatePhonotactics(word, structure, consonants, vowels)
          expect(validatePhonotactics(word, structure, consonants, vowels), `${structure} ${JSON.stringify(consonants)} ${JSON.stringify(word)}`).toBe(expected)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5000)
  })

  it.each([
    ["", "CV", ["p"], ["a"]],
    ["pa", null, ["p"], ["a"]],
    ["pa", "CV", [], ["a"]],
    ["pa", "CV", ["p"], null],
    ["1 2 3!", "CV", ["p"], ["a"]],
    ["papa", "CV", ["p"], ["a"]],
    ["PAPA", "CV", ["p"], ["a"]],
    ["pap", "CV", ["p"], ["a"]],
    ["shasa", "CV", ["sh", "s"], ["a"]],
  ])("matches the reference for %j with %j", (word, structure, consonants, vowels) => {
    expect(validatePhonotactics(word, structure, consonants, vowels)).toBe(
      legacyValidatePhonotactics(word, structure, consonants, vowels)
    )
  })

  it("stays fast on long words that almost fit (the regex took ~10 s at 31 letters, ~100 s at 37)", () => {
    const consonants = ["p", "t", "k", "s", "m", "n"]
    const vowels = ["a", "e", "i", "o", "u"]
    // Every consonant between vowels can be a coda or an onset, so the number of
    // segmentations doubles per syllable before the final "x" fails all of them.
    const started = performance.now()
    expect(validatePhonotactics("tat".repeat(12) + "x", "(C)(C)V(C)(C)", consonants, vowels)).toBe(false)
    expect(validatePhonotactics("tat".repeat(2_000) + "x", "(C)(C)V(C)(C)", consonants, vowels)).toBe(false)
    expect(validatePhonotactics("tat".repeat(2_000), "(C)(C)V(C)(C)", consonants, vowels)).toBe(true)
    expect(performance.now() - started).toBeLessThan(250)
  }, 2_000)
})
