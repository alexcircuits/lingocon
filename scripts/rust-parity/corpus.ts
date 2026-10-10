/**
 * Seeded pseudo-random lexicons for the Rust parity fixtures and benchmark.
 *
 * Deterministic on every engine: the PRNG is pure 32-bit integer arithmetic and the
 * character pools are fixed literals (no `normalize`/`toLowerCase` while generating), so the
 * inputs are byte-identical whichever Node version runs the generator. All characters are
 * assigned in Unicode 14 or earlier, so the TypeScript outputs are also identical on Node
 * builds carrying Unicode 15.1 through 17.
 */
import { SWADESH_LIST } from "@/lib/data/swadesh-list"
import type { FixtureEntry, FixtureSymbol, LexiconInput } from "./lexicon-types"

export type Rng = () => number

/** mulberry32: tiny, well-distributed, and identical across JS engines. */
export function mulberry32(seed: number): Rng {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]
export const chance = (rng: Rng, p: number): boolean => rng() < p
export const intBetween = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1))

type Pair = [string, string | null]
const toSymbols = (pairs: Pair[]): FixtureSymbol[] =>
  pairs.map(([symbol, capitalSymbol]) => ({ symbol, capitalSymbol }))
/** Lowercase letters with explicit capitals (written out: no engine case mapping at build time). */
const cased = (lower: string, upper: string): Pair[] => {
  const lows = Array.from(lower)
  const ups = Array.from(upper)
  if (lows.length !== ups.length) throw new Error(`cased(): ${lower} / ${upper} length mismatch`)
  return lows.map((c, i) => [c, ups[i]])
}

export const ALPHABETS: Record<string, FixtureSymbol[]> = {
  latinBasic: toSymbols(cased("abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ")),
  latinDigraphs: toSymbols([
    ...cased("acdeghilnostuz", "ACDEGHILNOSTUZ"),
    ["ch", "Ch"], ["sh", "Sh"], ["ng", "Ng"], ["th", "Th"], ["dz", "Dz"], ["d\u017e", "D\u017e"],
    ["\u01c6", "\u01c5"], ["lj", "Lj"], ["'", null], ["aa", "Aa"],
  ]),
  czech: toSymbols(
    cased(
      "a\u00e1bc\u010dd\u010fe\u00e9\u011bfghi\u00edjklmn\u0148o\u00f3pqr\u0159s\u0161t\u0165u\u00fa\u016fvwxy\u00fdz\u017e",
      "A\u00c1BC\u010cD\u010eE\u00c9\u011aFGHI\u00cdJKLMN\u0147O\u00d3PQR\u0158S\u0160T\u0164U\u00da\u016eVWXY\u00ddZ\u017d"
    )
  ),
  decomposedSymbols: toSymbols([
    ["e\u0301", "E\u0301"], ["a\u0328", "A\u0328"], ["o\u0308", null], ["u\u030a", "U\u030a"],
    ["s\u030c", "S\u030c"], ["n", "N"], ["t", "T"], ["r", "R"], ["k", "K"], ["\u0301", null], ["a", "A"],
  ]),
  greek: toSymbols([
    ...cased(
      "\u03b1\u03b2\u03b3\u03b4\u03b5\u03b6\u03b7\u03b8\u03b9\u03ba\u03bb\u03bc\u03bd\u03be\u03bf\u03c0\u03c1\u03c3\u03c4\u03c5\u03c6\u03c7\u03c8\u03c9",
      "\u0391\u0392\u0393\u0394\u0395\u0396\u0397\u0398\u0399\u039a\u039b\u039c\u039d\u039e\u039f\u03a0\u03a1\u03a3\u03a4\u03a5\u03a6\u03a7\u03a8\u03a9"
    ),
    ["\u03c2", null], ["\u03ac", "\u0386"],
  ]),
  cyrillic: toSymbols(
    cased(
      "\u0430\u0431\u0432\u0433\u0434\u0435\u0451\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f\u0456\u0457\u0454\u0491",
      "\u0410\u0411\u0412\u0413\u0414\u0415\u0401\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e\u041f\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042a\u042b\u042c\u042d\u042e\u042f\u0406\u0407\u0404\u0490"
    )
  ),
  turkish: toSymbols([
    ...cased("abc\u00e7defg\u011fhjklmno\u00f6prs\u015ftu\u00fcvyz", "ABC\u00c7DEFG\u011eHJKLMNO\u00d6PRS\u015eTU\u00dcVYZ"),
    ["\u0131", "I"], ["i", "\u0130"],
  ]),
  ipa: toSymbols(
    Array.from("pbtdkg\u0294mn\u014bfvsz\u0283\u0292xhlrjwie\u025ba\u0254ou\u0259\u02d0\u02c8\u02b0").map(
      (c): Pair => [c, null]
    ).concat([["t\u0283", null], ["d\u0292", null]])
  ),
  astral: toSymbols([
    ["\u{10330}", null], ["\u{10331}", null], ["\u{10332}", null], ["\u{1d51e}", "\u{1d504}"],
    ["\u{1f642}", null], ["\u{1f44d}", null], ["a", "A"], ["b", "B"],
  ]),
  hangul: toSymbols([
    ["\ud55c", null], ["\uad6d", null], ["\uc5b4", null], ["\u3131", null], ["\u1100\u1161", null], ["\uac00", null],
  ]),
  devanagari: toSymbols(
    Array.from("\u0915\u0937\u093e\u093f\u094d\u0928\u092e\u0924").map((c): Pair => [c, null]).concat([["\u0915\u094d\u0937", null]])
  ),
  emptyStrings: toSymbols([["", null], ["", ""], ["\u0300", null]]),
  empty: [],
  uppercaseOnly: toSymbols([["A", null], ["B", null], ["\u03a3", null], ["\u0130", null], ["\u00c5", null]]),
  punctuationLetters: toSymbols([["'", null], ["\u02bc", null], ["-", null], ["a", "A"], ["\u02bb", null], ["!", null], ["o", "O"]]),
}

/** Characters and clusters sprinkled into lemmas; each probes a branch of the matcher. */
export const NOISE: readonly string[] = [
  // whitespace, line terminators and controls (JS \s vs. not)
  " ", "\u00a0", "\t", "\r\n", "\n", "\u0085", "\ufeff", "\u2028", "\u3000", "\u200b", "\u180e", "\u000b", "\u0001",
  // digits: only ASCII is \d
  "0", "7", "\u0663", "\uff11", "\u00b2", "\u00bd", "\u2167",
  // punctuation and symbols
  "-", "'", "\u2019", "\u00ab", "\u00bb", "!", "?", ".", ",", "$", "\u20ac", "+", "^", "`", "\u00a8", "\u00b4",
  "\u02d8", "\u00a9", "\u2122", "\u2190", "\u00b0", "_", "\\", '"', "|", "~", "@", "#", "%", "&", "*",
  // Latin with diacritics, precomposed and decomposed; compatibility characters
  "\u00e9", "e\u0301", "\u011b", "e\u030c", "\u0105", "a\u0328", "\u01c5", "\u01c6", "\u01c4", "d\u017e", "\u00f1",
  "n\u0303", "\u00fc", "u\u0308", "\u00e5", "\u212b", "\u212a", "\u00df", "\u1e9e", "\u0131", "\u0130", "i\u0307",
  "\ufb01", "\u0149", "a\u0323\u0301", "a\u0301\u0323", "q\u0307\u0323", "\u0301", "\u0301\u0302", "x\u20dd",
  "1\u20e3", "\u00c9", "E\u0301", "\u00e1", "A",
  // Greek and Cyrillic
  "\u03a3", "\u03c3", "\u03c2", "\u0391\u03a3", "\u03ac", "\u03b1\u0301", "\u0390", "\u03ca\u0301", "\u0439",
  "\u0438\u0306", "\u0451", "\u0435\u0308", "\u0401",
  // astral and emoji sequences
  "\u{10330}", "\u{1d51e}", "\u{1d504}", "\u{13000}", "\u{1f642}", "\u{1f44d}\u{1f3fd}",
  "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}", "\u{1f1fa}\u{1f1e6}", "\u{1f1fa}", "\u2764\ufe0f",
  "\u{1f3f3}\ufe0f\u200d\u{1f308}", "#\ufe0f\u20e3", "\u{1f3f4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  // other scripts and clusters
  "\ud55c", "\u1112\u1161\u11ab", "\u3131", "\u0915\u094d\u0937", "\u0915\u093f", "\u0e01\u0e33", "\u0600\u0661",
  "\u65e5", "\u672c", "\uf900",
  // joiners and selectors
  "\u200d", "\u200c", "\ufe0f", "\u034f",
]

const SWADESH_WORDS: readonly string[] = SWADESH_LIST.map((concept) => concept.english)
const OTHER_WORDS: readonly string[] = ["zebra", "computer", "to compute", "tomorrow", "toe", "to-do", "ton", "eaten"]

type GlossShape = (w: string, v: string) => string
const GLOSS_SHAPES: readonly GlossShape[] = [
  (w) => w,
  (w) => w.toUpperCase(),
  (w) => `to ${w}`,
  (w) => `To ${w}`,
  (w) => `to\u00a0${w}`,
  (w) => `to\t${w}`,
  (w) => `to${w}`,
  (w) => `${w} (archaic)`,
  (w) => `(${w})`,
  (w, v) => `${w}, ${v}`,
  (w, v) => `${w}; ${v}`,
  (w, v) => `${w}/${v}`,
  (w) => `  ${w}  `,
  (w) => `\ufeff${w}`,
  (w) => `${w}\u0085`,
  (w) => `\u0085${w}`,
  (w) => `${w}\u2028`,
  (w) => `${w}\u180e`,
  (w) => `  to  ${w} `,
  (w) => `${w} (a, b)`,
  (w) => `to ${w} (x`,
  (w) => w.replace(/k/g, "\u212a"),
  (w) => w.replace(/i/g, "\u0130"),
  (w, v) => `${w} (${v})`,
  (w, v) => `to ${w}/to ${v}`,
  (w) => `${w}\u3000`,
  (w) => `${w}s`,
]

export function randomGloss(rng: Rng): string {
  const roll = rng()
  if (roll < 0.08) return ""
  if (roll < 0.15) return pick(rng, OTHER_WORDS)
  return pick(rng, GLOSS_SHAPES)(pick(rng, SWADESH_WORDS), pick(rng, SWADESH_WORDS))
}

export interface LemmaProfile {
  /** Probability that a token comes from `noise` instead of the alphabet. */
  noiseRate: number
  noise: readonly string[]
  minTokens: number
  maxTokens: number
  /** Probability of an empty lemma, a long (`longTokens`) lemma, and a repeated lemma. */
  emptyRate: number
  longRate: number
  repeatRate: number
  longTokens: [number, number]
}

export const FUZZ_PROFILE: LemmaProfile = {
  noiseRate: 0.3,
  noise: NOISE,
  minTokens: 1,
  maxTokens: 10,
  emptyRate: 0.04,
  longRate: 0.015,
  repeatRate: 0.03,
  longTokens: [40, 160],
}

export function randomLemma(rng: Rng, symbols: FixtureSymbol[], profile: LemmaProfile, previous: string[]): string {
  const roll = rng()
  if (roll < profile.emptyRate) return ""
  if (roll < profile.emptyRate + profile.repeatRate && previous.length > 0) return pick(rng, previous)
  const long = roll < profile.emptyRate + profile.repeatRate + profile.longRate
  const tokens = long ? intBetween(rng, profile.longTokens[0], profile.longTokens[1]) : intBetween(rng, profile.minTokens, profile.maxTokens)
  let lemma = ""
  for (let k = 0; k < tokens; k++) {
    if (symbols.length > 0 && !chance(rng, profile.noiseRate)) {
      const symbol = pick(rng, symbols)
      const capital = symbol.capitalSymbol
      lemma += capital && chance(rng, 0.2) ? capital : symbol.symbol
    } else {
      lemma += pick(rng, profile.noise)
    }
  }
  return lemma
}

export interface ParadigmProfile {
  present: string[]
  missing: string[]
  /** Probabilities of null, "", a present id and a missing id (remaining mass). */
  nullRate: number
  emptyRate: number
  presentRate: number
}

export function randomParadigmId(rng: Rng, profile: ParadigmProfile): string | null {
  const roll = rng()
  if (roll < profile.nullRate) return null
  if (roll < profile.nullRate + profile.emptyRate) return ""
  if (roll < profile.nullRate + profile.emptyRate + profile.presentRate && profile.present.length > 0) {
    return pick(rng, profile.present)
  }
  return pick(rng, profile.missing)
}

export function randomEntries(
  rng: Rng,
  count: number,
  symbols: FixtureSymbol[],
  lemmaProfile: LemmaProfile,
  paradigmProfile: ParadigmProfile
): FixtureEntry[] {
  const entries: FixtureEntry[] = []
  const previous: string[] = []
  for (let i = 0; i < count; i++) {
    const lemma = randomLemma(rng, symbols, lemmaProfile, previous)
    previous.push(lemma)
    entries.push({ lemma, gloss: randomGloss(rng), paradigmId: randomParadigmId(rng, paradigmProfile) })
  }
  return entries
}

export const CORPUS_SEED = 0x0e4c_0824

/** Two languages per alphabet (diacritics tolerance off, then on), ~3,000 entries in all. */
export function buildCorpusInputs(): Array<LexiconInput & { name: string }> {
  const rng = mulberry32(CORPUS_SEED)
  const names = Object.keys(ALPHABETS)
  const inputs: Array<LexiconInput & { name: string }> = []
  names.forEach((alphabetName, index) => {
    for (const allowsDiacritics of [false, true]) {
      const symbols = ALPHABETS[alphabetName]
      const present = [`lang${index}-p1`, `lang${index}-p2`, `lang${index}-p3`]
      const paradigmIds = present.filter(() => chance(rng, 0.7))
      const entries = randomEntries(rng, intBetween(rng, 90, 130), symbols, FUZZ_PROFILE, {
        present,
        missing: [`lang${index}-gone`, "P1", `LANG${index}-P1`],
        nullRate: 0.5,
        emptyRate: 0.1,
        presentRate: 0.25,
      })
      inputs.push({ name: `corpus ${alphabetName} diacritics=${allowsDiacritics}`, symbols, entries, paradigmIds, allowsDiacritics })
    }
  })
  return inputs
}
