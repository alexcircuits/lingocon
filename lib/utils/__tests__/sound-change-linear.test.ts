import { describe, expect, it } from "vitest"
import { applyRule, type SoundChangeRule } from "../sound-change"

/*
 * The previous rule engine, kept verbatim (minus its caches) as the reference:
 * one regex per rule, `(?<=left)(?:target)(?=right)`. Correct, but environments
 * built from classes whose members share prefixes ("a", "aa") backtrack
 * exponentially, and `applySoundChanges` runs it on the server for every entry.
 */
function legacyEscapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function legacyClassAlternation(set: Set<string>): string {
  const alt = Array.from(set)
    .filter(m => m.length > 0)
    .sort((a, b) => b.length - a.length)
    .map(legacyEscapeRegex)
    .join("|")
  return `(?:${alt})`
}

function legacyHasNonEmptyMember(set: Set<string>): boolean {
  for (const m of set) if (m.length > 0) return true
  return false
}

function legacyEnvToPattern(env: string, vowels: Set<string>, consonants: Set<string>, classes?: Map<string, Set<string>>) {
  if (!env || env === "_") return { pattern: "", boundary: false }
  const names =
    classes && classes.size > 0
      ? Array.from(classes.keys()).sort((a, b) => b.length - a.length).filter(n => legacyHasNonEmptyMember(classes.get(n)!))
      : []
  let pattern = ""
  let boundary = false
  let i = 0
  outer: while (i < env.length) {
    for (const name of names) {
      if (env.startsWith(name, i)) {
        pattern += legacyClassAlternation(classes!.get(name)!)
        i += name.length
        continue outer
      }
    }
    const ch = env[i]
    if (ch === "#") boundary = true
    else if (ch === "V") pattern += legacyClassAlternation(vowels)
    else if (ch === "C") pattern += legacyClassAlternation(consonants)
    else if (ch === ".") pattern += "."
    else pattern += legacyEscapeRegex(ch)
    i += 1
  }
  return { pattern, boundary }
}

function legacyApplyRule(
  word: string,
  rule: SoundChangeRule,
  vowels: Set<string>,
  consonants: Set<string>,
  classes?: Map<string, Set<string>>
): string {
  if (!rule.enabled || !rule.target) return word
  const left = legacyEnvToPattern(rule.leftEnv, vowels, consonants, classes)
  const right = legacyEnvToPattern(rule.rightEnv, vowels, consonants, classes)
  const targetClass = classes?.get(rule.target)
  const target =
    targetClass && legacyHasNonEmptyMember(targetClass)
      ? legacyClassAlternation(targetClass)
      : `(?:${legacyEscapeRegex(rule.target)})`
  const lookbehind =
    left.boundary && !left.pattern ? "^"
    : left.boundary ? `(?<=^${left.pattern})`
    : left.pattern ? `(?<=${left.pattern})`
    : ""
  const lookahead =
    right.boundary && !right.pattern ? "$"
    : right.boundary ? `(?=${right.pattern}$)`
    : right.pattern ? `(?=${right.pattern})`
    : ""
  try {
    return word.replace(new RegExp(`${lookbehind}${target}${lookahead}`, "g"), rule.replacement)
  } catch {
    return word
  }
}

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const VOWEL_SETS = [
  new Set(["a", "aa", "aː", "e"]),
  new Set(["i", "ii", "e", "ei"]),
  new Set(["", "e"]),
  new Set([""]),
  new Set<string>(),
]
const CONSONANT_SETS = [
  new Set(["t", "tʃ", "ʃ", "s", "k", "kw"]),
  new Set(["b", "$", ".", "\\"]),
  new Set(["😀", "\uD83D", "x"]),
]
const CLASS_MAPS: (Map<string, Set<string>> | undefined)[] = [
  undefined,
  new Map(),
  new Map([
    ["N", new Set(["m", "n", "ŋ"])],
    ["KW", new Set(["kw", "k"])],
    ["K", new Set(["k", "g"])],
    ["E", new Set([""])],
    ["Z", new Set(["", "z", "zz"])],
  ]),
]
const ENV_TOKENS = ["V", "C", "#", ".", "_", "N", "KW", "K", "E", "Z", "a", "t", "x", "$", "\\", "(", "😀", "\n", "ʃ"]
const TARGETS = ["a", "t", "tʃ", "N", "K", "KW", "E", "Z", "aa", "😀", "\\", ".", "$", "x", "\uDE00", "V"]
const REPLACEMENTS = ["", "e", "$&", "$$", "$`", "$'", "$1", "$<x>", "[$&]", "$", "x$0y", "𝔞", "$$&"]
const WORD_PIECES = ["a", "aa", "t", "ʃ", "tʃ", "k", "kw", "g", "m", "n", "e", "i", "x", "z", "\n", "😀", "\uD83D", " ", "$", ".", "b"]

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)]
}

function randomText(next: () => number, pieces: readonly string[], maxPieces: number): string {
  const count = Math.floor(next() * (maxPieces + 1))
  let text = ""
  for (let i = 0; i < count; i++) text += pick(next, pieces)
  return text
}

describe("applyRule (linear-time engine)", () => {
  it("returns exactly what the previous regex engine returned", () => {
    const next = rng(20261010)
    let checked = 0
    let changed = 0
    for (let n = 0; n < 60_000; n++) {
      const vowels = pick(next, VOWEL_SETS)
      const consonants = pick(next, CONSONANT_SETS)
      const classes = pick(next, CLASS_MAPS)
      const rule: SoundChangeRule = {
        id: "r",
        raw: "",
        target: next() < 0.05 ? "" : pick(next, TARGETS),
        replacement: pick(next, REPLACEMENTS),
        leftEnv: next() < 0.5 ? "" : randomText(next, ENV_TOKENS, 2),
        rightEnv: next() < 0.5 ? "" : randomText(next, ENV_TOKENS, 2),
        enabled: next() > 0.03,
      }
      const word = randomText(next, WORD_PIECES, 10)
      const expected = legacyApplyRule(word, rule, vowels, consonants, classes)
      expect(applyRule(word, rule, vowels, consonants, classes), JSON.stringify({ rule, word, vowels: [...vowels], consonants: [...consonants], classes: classes && [...classes.keys()] })).toBe(expected)
      if (expected !== word) changed++
      checked++
    }
    expect(checked).toBe(60_000)
    // The generator must actually exercise substitutions, not only no-ops.
    expect(changed).toBeGreaterThan(3_000)
  })

  it("stays fast when environment classes share prefixes (the regex took ~1.9 s at 24 slots on a 52-letter word)", () => {
    const vowels = new Set(["a", "aa"])
    const consonants = new Set(["b"])
    const right: SoundChangeRule = { id: "r", raw: "", target: "a", replacement: "e", leftEnv: "", rightEnv: "V".repeat(40) + "b", enabled: true }
    const left: SoundChangeRule = { ...right, leftEnv: "b" + "V".repeat(40), rightEnv: "" }
    const word = "a".repeat(2_000)
    const started = performance.now()
    expect(applyRule(word, right, vowels, consonants)).toBe(word)
    expect(applyRule(word, left, vowels, consonants)).toBe(word)
    expect(applyRule("b" + "a".repeat(60), left, vowels, consonants)).toBe("b" + "a".repeat(40) + "e".repeat(20))
    expect(performance.now() - started).toBeLessThan(250)
  }, 2_000)
})
