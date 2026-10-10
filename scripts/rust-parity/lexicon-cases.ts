/**
 * Hand-picked lexicons for the Rust parity fixtures: each one isolates an edge of
 * `validateStringAgainstAlphabet` / `checkMissingParadigms` / `matchSwadeshList`.
 * Expected outputs are never written here; they are computed by running main's TypeScript.
 *
 * Only characters assigned in Unicode 14 or earlier are used, so the fixtures are identical
 * whichever Node/ICU version (Unicode 15.1 to 17) regenerates or freshness-checks them.
 */
import type { FixtureEntry, FixtureSymbol } from "./lexicon-types"

export interface TargetedCase {
  name: string
  symbols: FixtureSymbol[]
  entries: FixtureEntry[]
  paradigmIds: string[]
  /** Omit to emit the case twice, with diacritics tolerance off and on. */
  allowsDiacritics?: boolean
}

const sym = (symbol: string, capitalSymbol: string | null = null): FixtureSymbol => ({ symbol, capitalSymbol })
const latin = (letters: string): FixtureSymbol[] => Array.from(letters).map((c) => sym(c, c.toUpperCase()))

/** Glosses cycled across targeted entries so every case also exercises the Swadesh matcher. */
const GLOSS_CYCLE = [
  "to eat",
  "big (in size)",
  "you (singular)",
  "Sun; star / moon",
  "",
  "\u212anee",
  "to\u00a0drink",
  "water\u0085",
  "\ufefffire",
  "I",
]

const lemmas = (...items: string[]): FixtureEntry[] =>
  items.map((lemma, i) => ({ lemma, gloss: GLOSS_CYCLE[i % GLOSS_CYCLE.length], paradigmId: null }))

const SCOTLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}"

export const TARGETED_CASES: TargetedCase[] = [
  {
    name: "empty alphabet: no undefined-symbol warnings, paradigms still checked",
    symbols: [],
    paradigmIds: [],
    entries: [
      { lemma: "xyz", gloss: "eat", paradigmId: null },
      { lemma: "\u011b", gloss: "", paradigmId: "missing" },
      { lemma: "", gloss: "", paradigmId: "gone" },
    ],
  },
  {
    name: "alphabet whose symbols are all empty strings",
    symbols: [sym(""), sym("", ""), sym("", null)],
    paradigmIds: [],
    entries: lemmas("abc", "a b-c 1", "\u00e9", ""),
  },
  {
    name: "digraphs and longest match",
    symbols: [sym("c", "C"), sym("h", "H"), sym("ch", "Ch"), sym("s", "S"), sym("sh", "SH")],
    paradigmIds: [],
    entries: lemmas("chs", "cch", "hc", "Chsh", "CH", "cHx", "shch", "xch", "SHs", "sH"),
  },
  {
    name: "greedy match does not backtrack",
    symbols: [sym("ab"), sym("bc"), sym("a")],
    paradigmIds: [],
    entries: lemmas("abc", "abbc", "aabc", "bca", "bc", "c"),
  },
  {
    name: "trigraph beats digraph",
    symbols: [sym("a"), sym("ab"), sym("abc"), sym("d")],
    paradigmIds: [],
    entries: lemmas("abcab", "abd", "abcd", "aabcx", "dabc"),
  },
  {
    name: "capitals: null and empty capitalSymbol",
    symbols: [sym("a", "A"), sym("b", null), sym("c", "")],
    paradigmIds: [],
    entries: lemmas("AbC", "aBc", "abc", "ABC"),
  },
  {
    name: "titlecase and capital digraph forms",
    symbols: [sym("d\u017e", "D\u017e"), sym("\u01c6", "\u01c5"), sym("d", "D"), sym("z", "Z")],
    paradigmIds: [],
    entries: lemmas("D\u017ed", "D\u017d", "\u01c5\u01c6", "\u01c4", "d\u017e", "dz\u030c", "Dz\u030c", "DZ"),
  },
  {
    name: "precomposed symbol vs decomposed lemma",
    symbols: [sym("\u00e9", "\u00c9"), sym("n", "N")],
    paradigmIds: [],
    entries: lemmas("e\u0301n", "\u00e9n", "E\u0301", "ne\u0301e", "\u00e9\u0301"),
  },
  {
    name: "decomposed symbol vs precomposed lemma",
    symbols: [sym("e\u0301", "E\u0301"), sym("a\u0328", null), sym("n")],
    paradigmIds: [],
    entries: lemmas("\u00e9n", "\u0105", "a\u0328n", "\u0105\u0301", "e\u0301\u0301", "\u0104"),
  },
  {
    name: "combining marks and canonical reordering",
    symbols: [sym("a"), sym("\u1ea1"), sym("q"), sym("\u0301")],
    paradigmIds: [],
    entries: lemmas(
      "a\u0323\u0301",
      "a\u0301\u0323",
      "\u0301a",
      "q\u0307\u0323",
      "q\u0323\u0307",
      "a\u0301",
      "\u0301\u0302",
      "a\u20dd",
      "\u1ea1\u0302"
    ),
  },
  {
    name: "czech letters with and without hacek",
    symbols: [...latin("abcdeinorsuz"), sym("\u010d", "\u010c"), sym("\u0161", "\u0160")],
    paradigmIds: [],
    entries: lemmas(
      "\u011b\u0161\u010d",
      "\u0159eka",
      "\u010cech",
      "\u0105\u0105",
      "\u017d\u00cdN\u011a",
      "e\u030c",
      "\ufb01n",
      "\u00df"
    ),
  },
  {
    name: "uppercase-only symbols are lowercased for diacritic bases",
    symbols: [sym("A"), sym("B"), sym("\u03a3"), sym("\u0130")],
    paradigmIds: [],
    entries: lemmas("a", "AB", "ab", "\u03c3", "\u03c2", "\u03a3", "i", "\u0130", "i\u0307", "I", "\u00e1"),
  },
  {
    name: "astral letters and emoji sequences",
    symbols: [sym("\u{10330}"), sym("\u{10331}"), sym("\u{1d51e}", "\u{1d504}"), sym("\u{1f642}"), sym("a", "A")],
    paradigmIds: [],
    entries: lemmas(
      "\u{10330}\u{10331}\u{10332}",
      "\u{1d504}\u{1d51e}",
      "\u{1f642}a",
      "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}",
      "\u{1f1fa}\u{1f1e6}",
      "\u{1f1fa}\u{1f1e6}\u{1f1fa}",
      "\u2764\ufe0f",
      "\u{1f44d}\u{1f3fd}",
      "\u{1f44d}",
      "#\ufe0f\u20e3",
      "1\u20e3",
      "\u{1f3f3}\ufe0f\u200d\u{1f308}",
      SCOTLAND_FLAG,
      "\u{13000}a"
    ),
  },
  {
    name: "emoji symbols with modifiers and joiners",
    symbols: [sym("\u{1f44d}"), sym("\u2764"), sym("#")],
    paradigmIds: [],
    entries: lemmas("\u{1f44d}\u{1f3fd}", "\u2764\ufe0f", "\u2764", "\u{1f44d}\u200d", "#\ufe0f\u20e3", "#\u0301"),
  },
  {
    name: "greek final sigma",
    symbols: [sym("\u03b1", "\u0391"), sym("\u03c3", "\u03a3"), sym("\u03bf", "\u039f"), sym("\u03ac", "\u0386")],
    paradigmIds: [],
    entries: lemmas(
      "\u0391\u03a3",
      "\u03b1\u03c2",
      "\u03c3\u03c2",
      "\u039f\u03a3\u039f\u03a3",
      "\u03ac\u03c3",
      "\u03b1\u0301",
      "\u0390",
      "\u0391\u03c2",
      "\u03ca\u0301"
    ),
  },
  {
    name: "greek multi-letter symbol",
    symbols: [sym("\u039f\u03a3"), sym("\u03b1")],
    paradigmIds: [],
    entries: lemmas("\u039f\u03a3", "\u03bf\u03c2", "\u03bf\u03c3", "\u039f\u03a3\u03b1", "\u0391\u03a3"),
  },
  {
    name: "turkish dotted and dotless i",
    symbols: [sym("i", "\u0130"), sym("\u0131", "I"), sym("k", "K")],
    paradigmIds: [],
    entries: lemmas("\u0130ki", "\u0131k\u0131", "IKI", "i\u0307", "\u0130", "\u0130\u0307", "\u212a", "\u0131\u0307"),
  },
  {
    name: "whitespace and line terminators",
    symbols: latin("ab"),
    paradigmIds: [],
    entries: lemmas(
      "a b",
      "a\u00a0b",
      "a\tb",
      "a\r\nb",
      "a\nb",
      "a\rb",
      "a\u0085b",
      "a\ufeffb",
      "a\u2028b",
      "a\u2029b",
      "a\u3000b",
      "a\u200bb",
      "a\u180eb",
      "a\u000bb",
      "a\u000cb",
      "a\u1680b",
      "a\u202fb",
      "a\u205fb",
      "a\u2007b",
      "a\u0001b",
      "a\u007fb",
      "   ",
      "\u0085",
      "\ufeff"
    ),
  },
  {
    name: "ascii and non-ascii digits",
    symbols: latin("ab"),
    paradigmIds: [],
    entries: lemmas("a1", "b0123456789", "a\u0663", "a\uff11", "a\u00b2", "a\u00bd", "a\u2167", "\u0661\u0662", "a\u0966", "1\u0301"),
  },
  {
    name: "punctuation and symbol graphemes",
    symbols: latin("ab"),
    paradigmIds: [],
    entries: lemmas(
      "a-b",
      "a'b",
      "a\u2019b",
      "\u00aba\u00bb",
      "a$",
      "a\u20ac",
      "a+b",
      "a^",
      "a`",
      "a\u00a8",
      "a\u02d8",
      "a\u00b4",
      "a\u00a9",
      "a\u2122",
      "a\u2190",
      "a\u00b0",
      "a_b",
      "a\\b",
      'a"b',
      "a|b~",
      "@#%&*",
      "$\u0301",
      "-\u0301",
      "a\u02bc",
      "a\u02c8",
      "a\u02d0",
      "a\u3001\u300c\u300d",
      "a\u{1f600}"
    ),
  },
  {
    name: "symbols that are punctuation or modifier letters",
    symbols: [sym("'"), sym("\u02bc"), sym("-"), sym("a", "A"), sym("\u02bb")],
    paradigmIds: [],
    entries: lemmas("a'a", "a\u02bca", "a\u02bba", "a\u2019a", "$\u0301", "'\u0301", "-a-"),
  },
  {
    name: "symbol made only of a combining mark",
    symbols: [sym("a"), sym("\u0301"), sym("e")],
    paradigmIds: [],
    entries: lemmas("a\u0301", "\u0301", "e\u0301", "\u0301\u0301", "o\u0301", "a\u0300"),
  },
  {
    name: "compatibility characters and singleton normalisation",
    symbols: [sym("\u00c5", null), sym("k", "K"), sym("\u8c48"), sym("fi")],
    paradigmIds: [],
    entries: lemmas("\u212b", "\u00c5", "\u212a", "\u212ak", "\uf900", "\ufb01", "fi", "A\u030a", "\u00e5"),
  },
  {
    name: "angstrom-sign symbol",
    symbols: [sym("\u212b", "\u212b"), sym("b")],
    paradigmIds: [],
    entries: lemmas("\u00c5b", "A\u030ab", "\u212bb", "\u00e5b"),
  },
  {
    name: "hangul syllables and jamo",
    symbols: [sym("\ud55c"), sym("\u1100\u1161"), sym("\u3131")],
    paradigmIds: [],
    entries: lemmas("\ud55c", "\u1112\u1161\u11ab", "\uac00", "\u1100\u1161", "\uac01", "\u3131\u3134", "\ud55c\uad6d"),
  },
  {
    name: "indic, thai and prepend clusters",
    symbols: [sym("\u0915"), sym("\u0937"), sym("\u094d"), sym("\u093f")],
    paradigmIds: [],
    entries: lemmas("\u0915\u094d\u0937", "\u0915\u093f", "\u0915\u094d", "\u0915\u0937", "\u0e01\u0e33", "\u0600\u0661", "\u0928"),
  },
  {
    name: "invalid symbol dedupe and message formatting",
    symbols: latin("a"),
    paradigmIds: [],
    entries: lemmas("xyx", "a,b, c", '"quoted"', "x, y", "\u00e9 \u00e9 \u00e9", 'Entry "x" uses', "${lemma}"),
  },
  {
    name: "duplicate entries",
    symbols: latin("ab"),
    paradigmIds: [],
    entries: lemmas("ab", "abx", "abx", "abx", "ab", "ABX"),
  },
  {
    name: "long lemmas",
    symbols: [...latin("abc"), sym("ch")],
    paradigmIds: [],
    entries: lemmas("abc".repeat(700), "ab-ch x\u00e9\u011b".repeat(120), "q".repeat(2000), "e\u0301".repeat(300)),
  },
  {
    name: "variation selectors and joiners",
    symbols: latin("ab"),
    paradigmIds: [],
    entries: lemmas("a\ufe00", "a\u200d", "a\u200c", "a\u034fb", "\u200d", "\ufe0f", "\u200da"),
  },
  {
    name: "cyrillic short i and yo",
    symbols: [sym("\u0438", "\u0418"), sym("\u0439", "\u0419"), sym("\u0435", "\u0415")],
    paradigmIds: [],
    entries: lemmas("\u0438\u0306", "\u0439", "\u0451", "\u0435\u0308", "\u0401", "\u0419\u0418"),
  },
  {
    name: "symbols with surrounding whitespace",
    symbols: [sym(" a"), sym("b "), sym("c")],
    paradigmIds: [],
    entries: lemmas(" a", "a", "b ", "cb c", "  a"),
  },
  {
    name: "paradigms present, missing, empty and null",
    symbols: latin("ab"),
    paradigmIds: ["p1", "p2", "P3"],
    entries: [
      { lemma: "ab", gloss: "", paradigmId: "p1" },
      { lemma: "ab", gloss: "", paradigmId: "missing" },
      { lemma: "abx", gloss: "", paradigmId: "" },
      { lemma: "ax", gloss: "", paradigmId: null },
      { lemma: "ab", gloss: "", paradigmId: "p3" },
      { lemma: "b", gloss: "", paradigmId: "p2" },
      { lemma: "b", gloss: "", paradigmId: " p1" },
      { lemma: "", gloss: "", paradigmId: "gone" },
      { lemma: "x\u0301", gloss: "", paradigmId: "gone" },
    ],
  },
  {
    name: "duplicated paradigm ids",
    symbols: latin("ab"),
    paradigmIds: ["x", "x", "y", ""],
    entries: [
      { lemma: "a", gloss: "", paradigmId: "x" },
      { lemma: "b", gloss: "", paradigmId: "z" },
      { lemma: "c", gloss: "", paradigmId: "" },
    ],
  },
  {
    name: "swadesh gloss shapes",
    symbols: latin("a"),
    paradigmIds: [],
    allowsDiacritics: false,
    entries: [
      "to eat",
      "BIG, large",
      "you",
      "(hand)",
      "foot (body part)",
      "to\tdrink",
      "toswim",
      "fly/fly",
      "\u0130",
      "worm (earth); snake",
      "to (x) see",
      "knee",
    ].map((gloss) => ({ lemma: "", gloss, paradigmId: null })),
  },
]
