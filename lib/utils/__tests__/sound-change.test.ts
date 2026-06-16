import { describe, expect, it } from "vitest"
import { parseRule, applyRule, applyPipeline, parseRules, batchApply } from "../sound-change"

/** Helper: parse a single rule string and apply it to a word. */
function run(ruleText: string, word: string): string {
  const rule = parseRule(ruleText)
  if (!rule) throw new Error(`failed to parse rule: ${ruleText}`)
  return applyRule(word, rule)
}

describe("parseRule", () => {
  it("parses target → replacement / left _ right", () => {
    const r = parseRule("k → tʃ / _i")
    expect(r).not.toBeNull()
    expect(r!.target).toBe("k")
    expect(r!.replacement).toBe("tʃ")
    expect(r!.leftEnv).toBe("")
    expect(r!.rightEnv).toBe("i")
  })

  it("treats ∅ / 0 / Ø as deletion (empty replacement)", () => {
    expect(parseRule("s → ∅ / V_V")!.replacement).toBe("")
    expect(parseRule("s → 0 / V_V")!.replacement).toBe("")
    expect(parseRule("s → Ø / V_V")!.replacement).toBe("")
  })

  it("accepts >, ->, → arrows", () => {
    expect(parseRule("a > e")!.replacement).toBe("e")
    expect(parseRule("a -> e")!.replacement).toBe("e")
    expect(parseRule("a → e")!.replacement).toBe("e")
  })

  it("skips comments and blank lines", () => {
    expect(parseRule("// comment")).toBeNull()
    expect(parseRule("# comment")).toBeNull()
    expect(parseRule("   ")).toBeNull()
  })
})

describe("applyRule — basic contexts", () => {
  it("applies an unconditional change everywhere", () => {
    expect(run("a → e", "banana")).toBe("benene")
  })

  it("applies a change before a specific segment", () => {
    expect(run("k → tʃ / _i", "kaki")).toBe("katʃi")
  })

  it("applies a word-final change", () => {
    expect(run("a → e / _#", "saga")).toBe("sage")
  })

  it("applies a word-initial change", () => {
    expect(run("b → p / #_", "baba")).toBe("paba")
  })
})

describe("applyRule — adjacent environments (regression: overlap consumption)", () => {
  // The classic bug: intervocalic deletion on a string of CVCVCV where the
  // vowels are SHARED between consecutive environments. A consuming regex eats
  // the shared vowel and skips every other target.
  it("deletes ALL intervocalic consonants, not every other one", () => {
    // s → ∅ / V_V on "asasa": both s are intervocalic → "aaa"
    expect(run("s → ∅ / V_V", "asasa")).toBe("aaa")
  })

  it("applies a left-context change to consecutive targets", () => {
    // a → e / V_ on "aaa": idx1 and idx2 are each preceded by a vowel → "aee"
    expect(run("a → e / V_", "aaa")).toBe("aee")
  })

  it("applies a right-context change to consecutive targets", () => {
    // a → e / _a on "aaa": idx0 and idx1 are each followed by a vowel → "eea"
    expect(run("a → e / _a", "aaa")).toBe("eea")
  })
})

describe("applyRule — phoneme classes", () => {
  it("matches any vowel for V", () => {
    expect(run("t → d / V_V", "atu")).toBe("adu")
    expect(run("t → d / V_V", "ata")).toBe("ada")
  })

  it("does not fire when the class does not match", () => {
    // t between consonants is not V_V
    expect(run("t → d / V_V", "stk")).toBe("stk")
  })
})

describe("applyPipeline & batchApply", () => {
  it("applies rules in order and records which fired", () => {
    const rules = parseRules(["k → tʃ / _i", "a → e / _#"].join("\n"))
    const res = applyPipeline("kaki", rules)
    expect(res.changed).toBe("katʃi")
    expect(res.rulesApplied).toEqual(["k → tʃ / _i"])
  })

  it("batch-applies across many words", () => {
    const rules = parseRules("s → ∅ / V_V")
    const out = batchApply(["asasa", "isi", "sos"], rules)
    expect(out.map(r => r.changed)).toEqual(["aaa", "ii", "sos"])
  })
})
