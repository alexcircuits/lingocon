/**
 * Seeded random inputs for the WASM ↔ TypeScript sound-change parity test:
 * whole rule programs as the user types them (class definitions, rules with
 * every arrow form, `$` replacements, environments, odd whitespace, comments
 * and garbage lines for the parser), phonology inventories as the editor
 * passes them, and words.
 *
 * Every string here is well-formed UTF-16: a lone surrogate cannot cross the
 * JS → Go boundary (see the dedicated test), so it is generated separately.
 */

/** Small deterministic PRNG (LCG) so failures are reproducible. */
export function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)]
}

export function randomText(next: () => number, pieces: readonly string[], maxPieces: number): string {
  const count = Math.floor(next() * (maxPieces + 1))
  let text = ""
  for (let i = 0; i < count; i++) text += pick(next, pieces)
  return text
}

const NBSP = String.fromCharCode(0xa0)
const NEL = String.fromCharCode(0x85) // whitespace for Go's unicode.IsSpace, not for JavaScript
const BOM = String.fromCharCode(0xfeff) // whitespace for JavaScript, not for Go's unicode.IsSpace
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000)
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const COMBINING_ACUTE = String.fromCharCode(0x301)
const E_LOWERED = "e" + String.fromCharCode(0x31e) // "e̞", a default vowel with a combining mark

/** undefined = the editor passes nothing and the engine uses its default inventory. */
const VOWEL_SETS: readonly (Set<string> | undefined)[] = [
  undefined,
  undefined,
  undefined,
  new Set(["a", "aa", "aː", "e"]),
  new Set(["i", "ii", "e", "ei", E_LOWERED]),
  new Set(["", "e"]),
  new Set([""]),
  new Set<string>(),
]
const CONSONANT_SETS: readonly (Set<string> | undefined)[] = [
  undefined,
  undefined,
  new Set(["t", "tʃ", "ʃ", "s", "k", "kw"]),
  new Set(["b", "$", ".", "\\", "#", "V"]),
  new Set(["😀", "x", "𝔞"]),
  new Set<string>(),
]

const CLASS_LINES = [
  "class N = m n ŋ",
  "class KW = kw k",
  "class K = k g",
  "class Z = z zz zzz",
  `class E = e ${E_LOWERED} ẽ`,
  "class J = 😀 𝔞 x",
  "class K = s", // redefinition: last one wins
  "class V = a", // reserved name: ignored
  "class K1 = x", // invalid name: neither a class nor a rule
  "class Q =", // no members
  "  class  Z = z\tzz  ",
  `class S = a${NBSP}b`,
  `class S = a${NEL}b`,
  `class S = a${BOM}b c c`,
  "class T = t > d",
  "class KWA = kwa",
]
const TARGETS = [
  "a", "t", "tʃ", "N", "K", "KW", "Z", "E", "J", "S", "T", "aa", "😀", "\\", ".", "$", "x",
  "V", "C", E_LOWERED, COMBINING_ACUTE, "kw", "-", "=", "z", "a a",
  // weighted towards text the words actually contain
  "a", "a", "a", "t", "t", "e", "k", "s", "K", "Z", "E", "N",
]
const ARROWS = [" → ", "→", " -> ", "->", " --> ", " ==> ", " > ", ">", " –> ", " —> ", " =-> ", " - > ", "-->"]
const REPLACEMENTS = [
  "", "e", "∅", "0", "Ø", "$&", "$$", "$`", "$'", "$1", "$<x>", "[$&]", "$", "x$0y", "𝔞", "$$&",
  "tʃ", "e" + COMBINING_ACUTE, "a b", "->", "_", "$&$&", "<$`|$'>",
]
const ENV_TOKENS = [
  "V", "C", "#", ".", "_", "N", "KW", "K", "Z", "E", "J", "a", "t", "x", "$", "\\", "(", "😀",
  " ", "ʃ", E_LOWERED, COMBINING_ACUTE, "/", "aa", "z",
  // weighted towards tokens that hold often
  "V", "V", "V", "C", "C", "C", ".", ".", "#", "#", "a", "t",
]
const PADDING = ["", "", "", "", " ", "\t", NBSP, BOM, NEL, IDEOGRAPHIC_SPACE, "\r"]
const GARBAGE = [
  "a", "-", ">", "=", "→", "/", "_", " ", "#", "$", "–", "—", "V", "C", NEL, BOM, "0", "class ", "K",
  LINE_SEPARATOR,
]
const COMMENTS = ["// a → e", "# a → e", "  // note", "#"]
const WORD_PIECES = [
  "a", "aa", "aː", "t", "ʃ", "tʃ", "k", "kw", "g", "m", "n", "ŋ", "e", E_LOWERED, COMBINING_ACUTE,
  "i", "x", "z", "zz", "😀", "𝔞", " ", "$", ".", "b", "#", "V", "-", "\r", LINE_SEPARATOR, "\n",
  "ẽ", "ä", "s", "d",
  "a", "a", "a", "t", "t", "e", "e", "k", "s", "i",
]

function ruleLine(next: () => number): string {
  const env =
    next() < 0.4
      ? ""
      : `${pick(next, [" / ", "/", " /"])}${randomText(next, ENV_TOKENS, 2)}${next() < 0.92 ? "_" : ""}${randomText(next, ENV_TOKENS, 2)}`
  return (
    pick(next, PADDING) +
    pick(next, TARGETS) +
    pick(next, ARROWS) +
    pick(next, REPLACEMENTS) +
    env +
    pick(next, PADDING)
  )
}

function programLine(next: () => number): string {
  const kind = next()
  if (kind < 0.6) return ruleLine(next)
  if (kind < 0.8) return pick(next, CLASS_LINES)
  if (kind < 0.89) return randomText(next, GARBAGE, 10)
  if (kind < 0.95) return pick(next, COMMENTS)
  return pick(next, PADDING)
}

export interface ParityCase {
  rulesText: string
  words: string[]
  vowels?: Set<string>
  consonants?: Set<string>
}

export function randomCase(next: () => number): ParityCase {
  // Half the programs open with class definitions, so class-name targets and
  // environment tokens resolve to classes rather than literal letters.
  const preamble = next() < 0.5 ? Array.from({ length: 2 + Math.floor(next() * 4) }, () => pick(next, CLASS_LINES)) : []
  const lines = [...preamble, ...Array.from({ length: 1 + Math.floor(next() * 5) }, () => programLine(next))]
  const words = Array.from({ length: 1 + Math.floor(next() * 6) }, () =>
    next() < 0.03 ? "" : randomText(next, WORD_PIECES, 10)
  )
  return {
    rulesText: lines.join(next() < 0.1 ? "\r\n" : "\n"),
    words,
    vowels: pick(next, VOWEL_SETS),
    consonants: pick(next, CONSONANT_SETS),
  }
}
