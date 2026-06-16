package soundchange

// Default phoneme classes — mirrors DEFAULT_VOWELS / DEFAULT_CONSONANTS in
// lib/utils/sound-change.ts. Kept in sync so the WASM core and the TS fallback
// behave identically.

var defaultVowels = []string{
	// Close
	"i", "y", "ɨ", "ʉ", "ɯ", "u",
	// Near-close
	"ɪ", "ʏ", "ʊ",
	// Close-mid
	"e", "ø", "ɘ", "ɵ", "ɤ", "o",
	// Mid
	"ə", "e̞", "ø̞", "ɤ̞", "o̞",
	// Open-mid
	"ɛ", "œ", "ɜ", "ɞ", "ʌ", "ɔ",
	// Near-open
	"æ", "ɐ",
	// Open
	"a", "ɶ", "ä", "ɑ", "ɒ",
	// Nasalized
	"ã", "ẽ", "ĩ", "õ", "ũ",
	// Long
	"aː", "eː", "iː", "oː", "uː", "ɛː", "ɔː", "æː", "ɑː",
	// Rhoticized
	"ɚ", "ɝ",
}

var defaultConsonants = []string{
	// Plosives
	"p", "b", "t", "d", "ʈ", "ɖ", "c", "ɟ", "k", "g", "ɡ", "q", "ɢ", "ʔ", "ʡ",
	// Nasals
	"m", "ɱ", "n", "ɳ", "ɲ", "ŋ", "ɴ",
	// Trills
	"ʙ", "r", "ʀ", "ʜ", "ʢ",
	// Taps/Flaps
	"ⱱ", "ɾ", "ɽ", "ɺ",
	// Fricatives
	"ɸ", "β", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "ʂ", "ʐ",
	"ç", "ʝ", "x", "ɣ", "χ", "ʁ", "ħ", "ʕ", "h", "ɦ",
	"ɕ", "ʑ", "ʍ", "ɧ", "ɼ",
	// Lateral fricatives
	"ɬ", "ɮ",
	// Affricates
	"ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "ʈʂ", "ɖʐ", "pf", "bv", "kx", "gɣ", "ɡɣ",
	// Approximants
	"ʋ", "ɹ", "ɻ", "j", "ɰ", "w", "ɥ",
	// Lateral approximants
	"l", "ɫ", "ɭ", "ʎ", "ʟ",
	// Implosives
	"ɓ", "ɗ", "ʄ", "ɠ", "ʛ",
}
