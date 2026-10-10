/**
 * Exhaustive per-code-point snapshot of the JavaScript engine's Unicode behaviour that the
 * lexicon analysis depends on, so the Rust crate's Unicode data can be compared against it for
 * every scalar value (not just the characters the corpus happens to contain).
 *
 * This describes the *engine* (V8 + ICU), not the repository's TypeScript, so it legitimately
 * changes with the Node version. It records `process.versions.unicode`; the freshness test only
 * compares it when the running Node carries the same Unicode version.
 */

export type Range = [number, number]

/** The "always allowed" grapheme test, verbatim from lib/utils/alphabet-validation.ts. */
const ALWAYS_ALLOWED = /^[\s\d\p{P}\p{S}]+$/u
const MARK = /^\p{M}$/u
const UNASSIGNED = /^\p{Cn}$/u
const JS_WHITESPACE = /^\s$/u

const HANGUL_SYLLABLES: Range = [0xac00, 0xd7a3]
const isSurrogate = (cp: number): boolean => cp >= 0xd800 && cp <= 0xdfff

function collectRanges(predicate: (s: string) => boolean): Range[] {
  const ranges: Range[] = []
  let start = -1
  for (let cp = 0; cp <= 0x110000; cp++) {
    const hit = cp <= 0x10ffff && !isSurrogate(cp) && predicate(String.fromCodePoint(cp))
    if (hit && start < 0) start = cp
    if (!hit && start >= 0) {
      ranges.push([start, cp - 1])
      start = -1
    }
  }
  return ranges
}

function collectMap(transform: (s: string) => string, skip?: Range): Array<[number, string]> {
  const out: Array<[number, string]> = []
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (isSurrogate(cp) || (skip && cp >= skip[0] && cp <= skip[1])) continue
    const s = String.fromCodePoint(cp)
    const mapped = transform(s)
    if (mapped !== s) out.push([cp, mapped])
  }
  return out
}

export interface UnicodeTables {
  note: string
  unicodeVersion: string
  icuVersion: string
  /** Code points the alphabet matcher always accepts: /^[\s\d\p{P}\p{S}]+$/u. */
  alwaysAllowed: Range[]
  /** \p{M} - what getBaseCharacter strips after NFD. */
  mark: Range[]
  /** /\s/u, which is also exactly what String.prototype.trim removes (asserted). */
  whitespace: Range[]
  /** \p{Cn} in this engine - code points it does not know (divergence is allowed only there). */
  unassigned: Range[]
  /** String.prototype.toLowerCase() of each single code point, where it changes. */
  lowercase: Array<[number, string]>
  /** normalize("NFD") of each code point where it changes (Hangul syllables excluded: algorithmic). */
  nfd: Array<[number, string]>
  /** normalize("NFC") of each code point where it changes. */
  nfc: Array<[number, string]>
  /** One code point per grapheme-break class that matters (see GRAPHEME_SAMPLES). */
  graphemeSamples: number[]
  /**
   * Intl.Segmenter("en", { granularity: "grapheme" }) over every ordered triple of samples
   * (a, b, c), in nested-loop order: one digit per triple, bit 0 = break between a and b,
   * bit 1 = break between b and c.
   */
  graphemeTriples: string
}

/**
 * Representatives of every Grapheme_Cluster_Break / Indic_Conjunct_Break / Extended_Pictographic
 * class, so the triple walk exercises each UAX #29 rule (GB3-GB13, GB9c) in context.
 */
const GRAPHEME_SAMPLES: readonly number[] = [
  0x61, 0x31, 0x20, 0x0d, 0x0a, 0x01, 0x200b, 0xfeff, // Other, CR, LF, Control
  0x0301, 0x0308, 0x200c, 0xfe0f, 0x1f3fb, 0xe0067, 0x093c, // Extend (incl. InCB=Extend)
  0x200d, // ZWJ
  0x1f1fa, 0x1f1e6, // Regional_Indicator
  0x0600, // Prepend
  0x0903, 0x093f, 0x0e33, // SpacingMark
  0x1100, 0x1161, 0x11a8, 0xac00, 0xac01, // L, V, T, LV, LVT
  0x1f468, 0x2764, 0x00a9, // Extended_Pictographic
  0x0915, 0x0937, 0x094d, // InCB=Consonant, InCB=Linker
  // Scripts that only joined GB9c conjuncts in Unicode 17 (consonant, linker), so a Unicode
  // 15.1/16 engine compared with `LINGOCON_UNICODE_TABLES` shows that skew here.
  0x1780, 0x17d2, // Khmer
  0x1000, 0x1039, // Myanmar
  0x1b13, 0x1b44, // Balinese
  0x05d0, 0x4e00, 0x0e01, // other scripts
]

function graphemeBoundaries(segmenter: Intl.Segmenter, codePoints: number[]): Set<number> {
  const breaks = new Set<number>()
  let position = 0
  for (const { segment } of segmenter.segment(String.fromCodePoint(...codePoints))) {
    position += Array.from(segment).length
    breaks.add(position)
  }
  return breaks
}

function graphemeTriples(): string {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
  let digits = ""
  for (const a of GRAPHEME_SAMPLES) {
    for (const b of GRAPHEME_SAMPLES) {
      for (const c of GRAPHEME_SAMPLES) {
        const breaks = graphemeBoundaries(segmenter, [a, b, c])
        digits += String((breaks.has(1) ? 1 : 0) + (breaks.has(2) ? 2 : 0))
      }
    }
  }
  return digits
}

export function buildUnicodeTables(): UnicodeTables {
  const whitespace = collectRanges((s) => JS_WHITESPACE.test(s))
  const trimmed = collectRanges((s) => s.trim() === "")
  if (JSON.stringify(trimmed) !== JSON.stringify(whitespace)) {
    throw new Error("String.prototype.trim and /\\s/u disagree in this engine; the Rust js_trim assumes they match")
  }
  return {
    note: "Generated by scripts/rust-parity/generate-lexicon-fixtures.ts from the running Node's V8/ICU. Do not edit.",
    unicodeVersion: process.versions.unicode ?? "unknown",
    icuVersion: process.versions.icu ?? "unknown",
    alwaysAllowed: collectRanges((s) => ALWAYS_ALLOWED.test(s)),
    mark: collectRanges((s) => MARK.test(s)),
    whitespace,
    unassigned: collectRanges((s) => UNASSIGNED.test(s)),
    lowercase: collectMap((s) => s.toLowerCase()),
    nfd: collectMap((s) => s.normalize("NFD"), HANGUL_SYLLABLES),
    nfc: collectMap((s) => s.normalize("NFC")),
    graphemeSamples: [...GRAPHEME_SAMPLES],
    graphemeTriples: graphemeTriples(),
  }
}
