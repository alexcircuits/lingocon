/**
 * X-SAMPA → IPA conversion (GitHub #64, contributed in PR #66 by Nikolay Ivankov).
 *
 * X-SAMPA spells IPA in ASCII: `S` = ʃ, `r\` = ɹ, `t_h` = tʰ, `"` = ˈ. Conversion is a single
 * left-to-right scan that always takes the LONGEST code at the current position and never re-reads
 * its own output. (Chaining global replaceAll calls — even longest-first — rewrites earlier results:
 * `@\` turned into "ə\", `n_d` + `dZ` collided, and every "ts" gained a tie bar.)
 *
 * Characters that are not X-SAMPA codes (including IPA letters) pass through unchanged, so
 * converting already-IPA text is a no-op for everything except the ASCII codes themselves.
 * Affricates are written with an explicit tie (`t_S`) or `ts\`-style codes; plain "ts" stays "ts".
 */

const cp = (codePoint: number) => String.fromCodePoint(codePoint)

// Source: the X-SAMPA chart (Wells 1995, as tabulated on Wikipedia's "X-SAMPA" page).
const XSAMPA: Record<string, string> = {
  // ── Lower-case letters ──
  a: "a", b: "b", "b_<": "ɓ", c: "c", d: "d", "d`": "ɖ", "d_<": "ɗ", e: "e", f: "f",
  g: "ɡ", "g_<": "ɠ", h: "h", "h\\": "ɦ", i: "i", j: "j", "j\\": "ʝ", k: "k", l: "l",
  "l`": "ɭ", "l\\": "ɺ", m: "m", n: "n", "n`": "ɳ", o: "o", p: "p", "p\\": "ɸ", q: "q",
  r: "r", "r`": "ɽ", "r\\": "ɹ", "r\\`": "ɻ", s: "s", "s`": "ʂ", "s\\": "ɕ", t: "t",
  "t`": "ʈ", u: "u", v: "v", "v\\": "ʋ", w: "w", x: "x", "x\\": "ɧ", y: "y", z: "z",
  "z`": "ʐ", "z\\": "ʑ",

  // ── Upper-case letters ──
  A: "ɑ", B: "β", "B\\": "ʙ", C: "ç", D: "ð", E: "ɛ", F: "ɱ", G: "ɣ", "G\\": "ɢ",
  "G\\_<": "ʛ", H: "ɥ", "H\\": "ʜ", I: "ɪ", "I\\": "ᵻ", J: "ɲ", "J\\": "ɟ", "J\\_<": "ʄ",
  K: "ɬ", "K\\": "ɮ", L: "ʎ", "L\\": "ʟ", M: "ɯ", "M\\": "ɰ", N: "ŋ", "N\\": "ɴ",
  O: "ɔ", "O\\": "ʘ", P: "ʋ", Q: "ɒ", R: "ʁ", "R\\": "ʀ", S: "ʃ", T: "θ", U: "ʊ",
  "U\\": "ᵿ", V: "ʌ", W: "ʍ", X: "χ", "X\\": "ħ", Y: "ʏ", Z: "ʒ",

  // ── Digits, other vowels and consonants ──
  "1": "ɨ", "2": "ø", "3": "ɜ", "3\\": "ɞ", "4": "ɾ", "5": "ɫ", "6": "ɐ", "7": "ɤ",
  "8": "ɵ", "9": "œ", "&": "ɶ", "@": "ə", "@\\": "ɘ", "@`": "ɚ", "{": "æ", "}": "ʉ",
  "?": "ʔ", "?\\": "ʕ", "<\\": "ʢ", ">\\": "ʡ",

  // ── Clicks, suprasegmentals, tone letters ──
  "|\\": "ǀ", "|\\|\\": "ǁ", "!\\": "ǃ", "=\\": "ǂ",
  '"': "ˈ", "%": "ˌ", ":": "ː", ":\\": "ˑ", "'": "ʲ", "-\\": "‿", "||": "‖",
  "^": "ꜛ", "!": "ꜜ",

  // ── Diacritics (combining unless noted) ──
  "=": cp(0x329), // syllabic
  "_=": cp(0x329),
  "~": cp(0x303), // nasalized
  "_~": cp(0x303),
  "`": "˞", // rhoticity (after a vowel)
  '_"': cp(0x308), // centralized
  "_+": cp(0x31f), // advanced
  "_-": cp(0x320), // retracted
  "_/": cp(0x30c), // rising tone
  "_0": cp(0x325), // voiceless
  "_>": "ʼ", // ejective
  "_?\\": "ˤ", // pharyngealized
  "_\\": cp(0x302), // falling tone
  "_^": cp(0x32f), // non-syllabic
  "_}": cp(0x31a), // no audible release
  "_A": cp(0x318), // advanced tongue root
  "_a": cp(0x33a), // apical
  "_B": cp(0x30f), // extra-low tone
  "_B_L": cp(0x1dc5), // low rising
  "_c": cp(0x31c), // less rounded
  "_d": cp(0x32a), // dental
  "_e": cp(0x334), // velarized or pharyngealized
  "_F": cp(0x302), // falling
  "_G": "ˠ", // velarized
  "_H": cp(0x301), // high tone
  "_H_T": cp(0x1dc4), // high rising
  "_h": "ʰ", // aspirated
  "_j": "ʲ", // palatalized
  "_k": cp(0x330), // creaky voiced
  "_L": cp(0x300), // low tone
  "_l": "ˡ", // lateral release
  "_M": cp(0x304), // mid tone
  "_m": cp(0x33b), // laminal
  "_N": cp(0x33c), // linguolabial
  "_n": "ⁿ", // nasal release
  "_O": cp(0x339), // more rounded
  "_o": cp(0x31e), // lowered
  "_q": cp(0x319), // retracted tongue root
  "_R": cp(0x30c), // rising
  "_R_F": cp(0x1dc8), // rising-falling
  "_r": cp(0x31d), // raised
  "_T": cp(0x30b), // extra-high tone
  "_t": cp(0x324), // breathy voiced
  "_v": cp(0x32c), // voiced
  "_w": "ʷ", // labialized
  "_X": cp(0x306), // extra-short
  "_x": cp(0x33d), // mid-centralized
  // A lone "_" between two symbols is the tie bar: t_S → t͡ʃ.
  _: cp(0x361),
}

const MAX_CODE_LENGTH = Math.max(...Object.keys(XSAMPA).map((code) => code.length))

export function xsampaToIpa(input: string): string {
  let out = ""
  let i = 0
  while (i < input.length) {
    let matched = false
    for (let len = Math.min(MAX_CODE_LENGTH, input.length - i); len > 0; len--) {
      const ipa = XSAMPA[input.slice(i, i + len)]
      if (ipa !== undefined) {
        out += ipa
        i += len
        matched = true
        break
      }
    }
    if (!matched) {
      // Not an X-SAMPA code (spaces, punctuation, IPA already): copy one code point.
      const char = String.fromCodePoint(input.codePointAt(i)!)
      out += char
      i += char.length
    }
  }
  return out
}
