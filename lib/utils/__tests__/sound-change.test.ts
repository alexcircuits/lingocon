import { describe, expect, it } from "vitest"
import { parseRule, applyRule, applyPipeline, parseRules, batchApply, parseProgram } from "../sound-change"

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

  it("accepts multi-dash and unicode-dash arrows without corrupting the target", () => {
    // The double-hyphen `-->` is the most natural way users type an arrow.
    // Regression: it used to split on the *second* hyphen, gluing a stray `-`
    // onto the target ("a -") so the rule silently matched nothing.
    for (const arrow of ["-->", "--->", "==>", "—>", "–>"]) {
      const r = parseRule(`a ${arrow} e / C_V`)
      expect(r, arrow).not.toBeNull()
      expect(r!.target, arrow).toBe("a")
      expect(r!.replacement, arrow).toBe("e")
      expect(r!.leftEnv, arrow).toBe("C")
      expect(r!.rightEnv, arrow).toBe("V")
    }
  })

  it("applies `a --> e / C_V` correctly end-to-end", () => {
    const r = parseRule("a --> e / C_V")!
    // first `a` is C_V (f_a); second `a` is not (a_n) -> only the first changes
    expect(applyRule("faang", r)).toBe("feang")
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

/** Strip `id` so rule arrays can be compared by content only. */
function withoutIds(rules: ReturnType<typeof parseRules>) {
  return rules.map(({ id, ...rest }) => rest)
}

describe("parseProgram", () => {
  it("collects class definitions and leaves rules untouched", () => {
    const text = ["class K = p t k", "// a comment", "class S = tʃ s", "a → e / _#", "K → h"].join("\n")
    const prog = parseProgram(text)

    expect(prog.classes.get("K")).toEqual(new Set(["p", "t", "k"]))
    expect(prog.classes.get("S")).toEqual(new Set(["tʃ", "s"]))
    expect(prog.classes.size).toBe(2)

    expect(withoutIds(prog.rules)).toEqual(withoutIds(parseRules("a → e / _#\nK → h")))
  })

  it("last class definition wins on duplicate name", () => {
    const text = ["class K = p t", "class K = k g"].join("\n")
    const prog = parseProgram(text)
    expect(prog.classes.get("K")).toEqual(new Set(["k", "g"]))
    expect(prog.classes.size).toBe(1)
  })

  it("ignores malformed class lines instead of crashing or treating them as rules", () => {
    const malformed = ["class = x", "class K", "class K =", "class K =    ", "class K L = p t"]
    for (const line of malformed) {
      const prog = parseProgram(line)
      expect(prog.classes.size, line).toBe(0)
      expect(prog.rules.length, line).toBe(0)
    }
  })

  it("rejects class names V and C (built-ins take precedence)", () => {
    const prog = parseProgram("class V = a e i\nclass C = p t k")
    expect(prog.classes.size).toBe(0)
  })

  it("matches parseRules output (minus id) for class-free text", () => {
    const texts = [
      "a → e",
      "k → tʃ / _i",
      "a → e / _#\nb → p / #_",
      "// comment\n\na → e\n# comment\nb → p",
      "s → ∅ / V_V\na → e / V_\na → e / _a",
      "",
      "   \n// only comments\n# nope\n",
    ]
    for (const text of texts) {
      expect(withoutIds(parseProgram(text).rules), text).toEqual(withoutIds(parseRules(text)))
    }
  })
})

describe("applyRule / applyPipeline — user-defined classes", () => {
  const K = new Set(["p", "t", "k"])

  it("uses a class in the RIGHT environment", () => {
    const classes = new Map([["K", K]])
    const rule = parseRule("a → e / _K")!
    // "atapa": both a's followed by a K member (t, p) raise; the final a
    // (followed by nothing) does not.
    expect(applyRule("atapa", rule, undefined, undefined, classes)).toBe("etepa")
    // "asa": a followed by s, which is not a K member -> unchanged.
    expect(applyRule("asa", rule, undefined, undefined, classes)).toBe("asa")
  })

  it("uses a class in the LEFT environment", () => {
    const classes = new Map([["K", K]])
    const rule = parseRule("a → e / K_")!
    // "apa": second a preceded by p (a K member) -> raised. First a has no
    // left context at all -> unchanged.
    expect(applyRule("apa", rule, undefined, undefined, classes)).toBe("ape")
    // "asa": a preceded by s, not a K member -> unchanged.
    expect(applyRule("asa", rule, undefined, undefined, classes)).toBe("asa")
  })

  it("uses a class as the TARGET with deletion", () => {
    const classes = new Map([["K", K]])
    const rule = parseRule("K → ∅ / _#")!
    expect(applyRule("tap", rule, undefined, undefined, classes)).toBe("ta")
    // Final consonant is "s", not a K member -> unchanged.
    expect(applyRule("kass", rule, undefined, undefined, classes)).toBe("kass")
  })

  it("uses a class as the TARGET mapping any member to a replacement", () => {
    const classes = new Map([["K", K]])
    const rule = parseRule("K → h")!
    expect(applyRule("tapak", rule, undefined, undefined, classes)).toBe("hahah")
  })

  it("matches a multi-rune class member", () => {
    const classes = new Map([["S", new Set(["tʃ", "s"])]])
    const rule = parseRule("a → e / S_")!
    expect(applyRule("tʃa", rule, undefined, undefined, classes)).toBe("tʃe")
    expect(applyRule("sa", rule, undefined, undefined, classes)).toBe("se")
    expect(applyRule("xa", rule, undefined, undefined, classes)).toBe("xa")
  })

  it("resolves the longest class name first (K vs KW)", () => {
    const classes = new Map([
      ["K", new Set(["p", "t"])],
      ["KW", new Set(["kʷ", "gʷ"])],
    ])
    const rule = parseRule("a → e / KW_")!
    // "a" preceded by "kʷ" (a KW member) -> raised.
    expect(applyRule("kʷa", rule, undefined, undefined, classes)).toBe("kʷe")
    // "a" preceded by "p" (a K member, NOT a KW member) -> unchanged, proving
    // the walker consumed "KW" as one token and not "K" + literal "W".
    expect(applyRule("pa", rule, undefined, undefined, classes)).toBe("pa")

    // The standalone class K still resolves correctly on its own.
    const ruleK = parseRule("a → e / K_")!
    expect(applyRule("pa", ruleK, undefined, undefined, classes)).toBe("pe")
  })

  it("does not change behavior when classes is omitted (back-compat)", () => {
    const rules = parseRules("s → ∅ / V_V")
    const withoutClasses = batchApply(["asasa", "isi", "sos"], rules)
    const withUndefinedClasses = batchApply(["asasa", "isi", "sos"], rules, undefined, undefined, undefined)
    expect(withUndefinedClasses.map(r => r.changed)).toEqual(withoutClasses.map(r => r.changed))
    expect(withoutClasses.map(r => r.changed)).toEqual(["aaa", "ii", "sos"])
  })

  it("applyPipeline threads classes through to every rule", () => {
    const classes = new Map([["K", K]])
    const rules = parseRules("K → h\na → e / _#")
    const res = applyPipeline("tapak", rules, undefined, undefined, classes)
    expect(res.changed).toBe("hahah")
  })
})
