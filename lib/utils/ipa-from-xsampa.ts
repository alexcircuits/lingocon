//import entry from "next/dist/server/typescript/rules/entry";
import {list} from "postcss";
import {unzip} from "node:zlib";

const IPA_CONSONANTS =  [
    // Pulmonic consonants organized by manner and place
    { symbol: "p", name: "voiceless bilabial plosive", xsampa: "p" },
    { symbol: "b", name: "voiced bilabial plosive", xsampa: "b" },
    { symbol: "t", name: "voiceless alveolar plosive", xsampa: "t" },
    { symbol: "d", name: "voiced alveolar plosive", xsampa: "d" },
    { symbol: "ʈ", name: "voiceless retroflex plosive", xsampa: "t`" },
    { symbol: "ɖ", name: "voiced retroflex plosive", xsampa: "d`" },
    { symbol: "c", name: "voiceless palatal plosive", xsampa: "c" },
    { symbol: "ɟ", name: "voiced palatal plosive", xsampa: "J\\" },
    { symbol: "k", name: "voiceless velar plosive", xsampa: "k" },
    { symbol: "g", name: "voiced velar plosive", xsampa: "g" },
    { symbol: "ɡ", name: "voiced velar plosive (script g)", xsampa: "g" },
    { symbol: "q", name: "voiceless uvular plosive", xsampa: "q" },
    { symbol: "ɢ", name: "voiced uvular plosive", xsampa: "G\\" },
    { symbol: "ʔ", name: "glottal stop", xsampa: "?" },
    // Nasals
    { symbol: "m", name: "bilabial nasal", xsampa: "m" },
    { symbol: "ɱ", name: "labiodental nasal", xsampa: "F" },
    { symbol: "n", name: "alveolar nasal", xsampa: "n" },
    { symbol: "ɳ", name: "retroflex nasal", xsampa: "n`" },
    { symbol: "ɲ", name: "palatal nasal", xsampa: "J" },
    { symbol: "ŋ", name: "velar nasal", xsampa: "N" },
    { symbol: "ɴ", name: "uvular nasal", xsampa: "N\\" },
    // Trills
    { symbol: "ʙ", name: "bilabial trill", xsampa: "B\\" },
    { symbol: "r", name: "alveolar trill", xsampa: "r" },
    { symbol: "ʀ", name: "uvular trill", xsampa: "R\\" },
    // Taps/Flaps
    { symbol: "ⱱ", name: "labiodental flap", xsampa: "b\\" },
    { symbol: "ɾ", name: "alveolar tap", xsampa: "4" },
    { symbol: "ɽ", name: "retroflex flap", xsampa: "r`" },
    { symbol: "ɺ", name: "alveolar lateral flap", xsampa: "l\\" },
    // Fricatives
    { symbol: "ɸ", name: "voiceless bilabial fricative", xsampa: "p\\" },
    { symbol: "β", name: "voiced bilabial fricative", xsampa: "B" },
    { symbol: "f", name: "voiceless labiodental fricative", xsampa: "f" },
    { symbol: "v", name: "voiced labiodental fricative", xsampa: "v" },
    { symbol: "θ", name: "voiceless dental fricative", xsampa: "T" },
    { symbol: "ð", name: "voiced dental fricative", xsampa: "D" },
    { symbol: "s", name: "voiceless alveolar fricative", xsampa: "s" },
    { symbol: "z", name: "voiced alveolar fricative", xsampa: "z" },
    { symbol: "ʃ", name: "voiceless postalveolar fricative", xsampa: "S" },
    { symbol: "ʒ", name: "voiced postalveolar fricative", xsampa: "Z" },
    { symbol: "ʂ", name: "voiceless retroflex fricative", xsampa: "s`" },
    { symbol: "ʐ", name: "voiced retroflex fricative", xsampa: "z`" },
    { symbol: "ç", name: "voiceless palatal fricative", xsampa: "C" },
    { symbol: "ʝ", name: "voiced palatal fricative", xsampa: "j\\" },
    { symbol: "x", name: "voiceless velar fricative", xsampa: "x" },
    { symbol: "ɣ", name: "voiced velar fricative", xsampa: "G" },
    { symbol: "χ", name: "voiceless uvular fricative", xsampa: "X" },
    { symbol: "ʁ", name: "voiced uvular fricative", xsampa: "R" },
    { symbol: "ħ", name: "voiceless pharyngeal fricative", xsampa: "X\\" },
    { symbol: "ʕ", name: "voiced pharyngeal fricative", xsampa: "?\\" },
    { symbol: "h", name: "voiceless glottal fricative", xsampa: "h" },
    { symbol: "ɦ", name: "voiced glottal fricative", xsampa: "h\\" },
    // Lateral fricatives
    { symbol: "ɬ", name: "voiceless alveolar lateral fricative", xsampa: "K" },
    { symbol: "ɮ", name: "voiced alveolar lateral fricative", xsampa: "K\\" },
    // Approximants
    { symbol: "ʋ", name: "labiodental approximant", xsampa: ['v\\\\', 'P'] },
    { symbol: "ɹ", name: "alveolar approximant", xsampa: "r\\" },
    { symbol: "ɻ", name: "retroflex approximant", xsampa: "r\\`" },
    { symbol: "j", name: "palatal approximant", xsampa: "j" },
    { symbol: "ɰ", name: "velar approximant", xsampa: "M\\" },
    // Lateral approximants
    { symbol: "l", name: "alveolar lateral approximant", xsampa: "l" },
    { symbol: "ɫ", name: "velarized alveolar lateral approximant", xsampa: "5" },
    { symbol: "ɭ", name: "retroflex lateral approximant", xsampa: "l`" },
    { symbol: "ʎ", name: "palatal lateral approximant", xsampa: "L" },
    { symbol: "ʟ", name: "velar lateral approximant", xsampa: "L\\" },
    // Other consonants
    { symbol: "ʍ", name: "voiceless labial-velar fricative", xsampa: "W" },
    { symbol: "w", name: "labial-velar approximant", xsampa: "w" },
    { symbol: "ɥ", name: "labial-palatal approximant", xsampa: "H" },
    { symbol: "ʜ", name: "voiceless epiglottal fricative", xsampa: "H\\" },
    { symbol: "ʢ", name: "voiced epiglottal fricative", xsampa: "<\\" },
    { symbol: "ʡ", name: "epiglottal plosive", xsampa: ">\\" },
    // Co-articulated
    { symbol: "ɕ", name: "voiceless alveolo-palatal fricative", xsampa: "s\\" },
    { symbol: "ʑ", name: "voiced alveolo-palatal fricative", xsampa: "z\\" },
    { symbol: "ɧ", name: "voiceless sj-sound", xsampa: "x\\" },
    { symbol: "ɼ", name: "bidental fricative", xsampa: "ɼ" },
    // Affricates
    { symbol: "t͡s", name: "voiceless alveolar affricate", xsampa: "ts" },
    { symbol: "d͡z", name: "voiced alveolar affricate", xsampa: "dz" },
    { symbol: "t͡ʃ", name: "voiceless postalveolar affricate", xsampa: "tS" },
    { symbol: "d͡ʒ", name: "voiced postalveolar affricate", xsampa: "dZ" },
    { symbol: "t͡ɕ", name: "voiceless alveolo-palatal affricate", xsampa: ["ts\\", "tɕ"] },
    { symbol: "d͡ʑ", name: "voiced alveolo-palatal affricate", xsampa: ["dz\\", "dʑ" ] },
    { symbol: "ʈ͡ʂ", name: "voiceless retroflex affricate", xsampa: ["t`s`", "t`ʂ", "ʈs`", "ʈʂ"] },
    { symbol: "ɖ͡ʐ", name: "voiced retroflex affricate", xsampa: ["d`z`", "d`ʐ", "ɖz`", "ɖʐ"] },
    { symbol: "p͡f", name: "voiceless labiodental affricate", xsampa: "pf" },
    { symbol: "b͡v", name: "voiced labiodental affricate", xsampa: "bv" },
    { symbol: "k͡x", name: "voiceless velar affricate", xsampa: "kx" },
    { symbol: "g͡ɣ", name: "voiced velar affricate", xsampa: "gG" },
]
const IPA_VOWELS =  [
    // Close vowels
    { symbol: "i", name: "close front unrounded vowel", xsampa: "i" },
    { symbol: "y", name: "close front rounded vowel", xsampa: "y" },
    { symbol: "ɨ", name: "close central unrounded vowel", xsampa: "1" },
    { symbol: "ʉ", name: "close central rounded vowel", xsampa: "}" },
    { symbol: "ɯ", name: "close back unrounded vowel", xsampa: "M" },
    { symbol: "u", name: "close back rounded vowel", xsampa: "u" },
    // Near-close vowels
    { symbol: "ɪ", name: "near-close front unrounded vowel", xsampa: "I" },
    { symbol: "ʏ", name: "near-close front rounded vowel", xsampa: "Y" },
    { symbol: "ʊ", name: "near-close back rounded vowel", xsampa: "U" },
    // Close-mid vowels
    { symbol: "e", name: "close-mid front unrounded vowel", xsampa: "e" },
    { symbol: "ø", name: "close-mid front rounded vowel", xsampa: "2" },
    { symbol: "ɘ", name: "close-mid central unrounded vowel", xsampa: "@\"" },
    { symbol: "ɵ", name: "close-mid central rounded vowel", xsampa: "8" },
    { symbol: "ɤ", name: "close-mid back unrounded vowel", xsampa: "7" },
    { symbol: "o", name: "close-mid back rounded vowel", xsampa: "o" },
    // Mid vowels
    { symbol: "ə", name: "mid central vowel (schwa)", xsampa: "@" },
    { symbol: "e̞", name: "mid front unrounded vowel", xsampa: "e_o" },
    { symbol: "ø̞", name: "mid front rounded vowel", xsampa: "2_o" },
    { symbol: "ɤ̞", name: "mid back unrounded vowel", xsampa: "4_o"},
    { symbol: "o̞", name: "mid back rounded vowel", xsampa: "o_o" },
    // Open-mid vowels
    { symbol: "ɛ", name: "open-mid front unrounded vowel", xsampa: "E" },
    { symbol: "œ", name: "open-mid front rounded vowel", xsampa: "9" },
    { symbol: "ɜ", name: "open-mid central unrounded vowel", xsampa: "3" },
    { symbol: "ɞ", name: "open-mid central rounded vowel", xsampa: "3\\" },
    { symbol: "ʌ", name: "open-mid back unrounded vowel", xsampa: "V" },
    { symbol: "ɔ", name: "open-mid back rounded vowel", xsampa: "O" },
    // Near-open vowels
    { symbol: "æ", name: "near-open front unrounded vowel", xsampa: "{" },
    { symbol: "ɐ", name: "near-open central vowel", xsampa: "6" },
    // Open vowels
    { symbol: "a", name: "open front unrounded vowel", xsampa: "a" },
    { symbol: "ɶ", name: "open front rounded vowel", xsampa: "&" },
    { symbol: "ä", name: "open central unrounded vowel", xsampa: "ä" },
    { symbol: "ɑ", name: "open back unrounded vowel", xsampa: "A" },
    { symbol: "ɒ", name: "open back rounded vowel", xsampa: "Q" },
]
const IPA_DIACRITICS =  [
    // Voicing
    { symbol: "̥", name: "voiceless", xsampa: "_0" },
    { symbol: "̬", name: "voiced", xsampa: "_v" },
    { symbol: "ʰ", name: "aspirated", xsampa: "_h" },
    // Syllabicity
    { symbol: "̩", name: "syllabic", xsampa: ['=', '_='] },
    { symbol: "̯", name: "non-syllabic", xsampa: "_^" },
    // Release
    { symbol: "ʷ", name: "labialized", xsampa: "_w" },
    { symbol: "ʲ", name: "palatalized", xsampa: ["'", '_j'] },
    { symbol: "ˠ", name: "velarized", xsampa: "_G" },
    { symbol: "ˤ", name: "pharyngealized", xsampa: "_?\\" },
    { symbol: "ⁿ", name: "nasal release", xsampa: "_n" },
    { symbol: "ˡ", name: "lateral release", xsampa: "_l" },
    { symbol: "˺", name: "no audible release", xsampa: "˺" },
    // Phonation
    { symbol: "̤", name: "breathy voiced", xsampa: "_t" },
    { symbol: "̰", name: "creaky voiced", xsampa: "_k" },
    // Tongue root
    { symbol: "̈", name: "centralized", xsampa: "_\"" },
    { symbol: "̽", name: "mid-centralized", xsampa: "_x" },
    { symbol: "̘", name: "advanced tongue root", xsampa: "_A" },
    { symbol: "̙", name: "retracted tongue root", xsampa: "_q" },
    // Articulation
    { symbol: "̟", name: "advanced", xsampa: "_+" },
    { symbol: "̠", name: "retracted", xsampa: "_-" },
    { symbol: "̪", name: "dental", xsampa: "_d" },
    { symbol: "̺", name: "apical", xsampa: "_a" },
    { symbol: "̻", name: "laminal", xsampa: "_m" },
    { symbol: "̃", name: "nasalized", xsampa: "~" },
    { symbol: "̼", name: "linguolabial", xsampa: "_N" },
    { symbol: "̴", name: "velarized or pharyngealized", xsampa: "_e" },
    { symbol: "ˁ", name: "epiglottalized/uvularized", xsampa: "ˁ" },
    { symbol: "̹", name: "more rounded", xsampa: "_O" },
    { symbol: "̜", name: "less rounded", xsampa: "_c" },
    { symbol: "̝", name: "raised", xsampa: "_r" },
    { symbol: "̞", name: "lowered", xsampa: "_o" },
    // Rhoticity
    { symbol: "˞", name: "rhoticity", xsampa: "`" },
    { symbol: "ɚ", name: "rhoticized schwa", xsampa: "@`" },
    { symbol: "ɝ", name: "rhoticized open-mid central", xsampa: "3`" },
    // Tones (Tone letters)
    { symbol: "˥", name: "extra high", xsampa: "__T" },
    { symbol: "˦", name: "high", xsampa: "__H" },
    { symbol: "˧", name: "mid", xsampa: "__M" },
    { symbol: "˨", name: "low", xsampa: "__L" },
    { symbol: "˩", name: "extra low", xsampa: "__B" },
    { symbol: "꜖", name: "extra low", xsampa: "꜖" },
    { symbol: "꜒", name: "high", xsampa: "꜒" },
    { symbol: "ʼ", name: "ejective", xsampa: "_>" },
    { symbol: "˪", name: "lateral release", xsampa: "˪" },
]

const IPA_SUPRASEGMENTALS =  [
    // Stress
    { symbol: "ˈ", name: "primary stress", xsampa: "\"" },
    { symbol: "ˌ", name: "secondary stress", xsampa: "%" },
    // Length
    { symbol: "ː", name: "long", xsampa: ":" },
    { symbol: "ˑ", name: "half-long", xsampa: ":\\" },
    { symbol: "̆", name: "extra-short", xsampa: "_X" },
    // Tone marks
    { symbol: "̋", name: "extra high tone", xsampa: "_T" },
    { symbol: "́", name: "high tone", xsampa: "_H" },
    { symbol: "̄", name: "mid tone", xsampa: "_M" },
    { symbol: "̀", name: "low tone", xsampa: "_L" },
    { symbol: "̏", name: "extra low tone", xsampa: "_B" },
    { symbol: "̌", name: "rising tone", xsampa: ['_/', '_R'] },
    { symbol: "̂", name: "falling tone", xsampa: ['_\\', '_F'] },
    { symbol: "᷄", name: "high rising tone", xsampa: "᷄" },
    { symbol: "᷅", name: "low rising tone", xsampa: "᷅" },
    { symbol: "᷈", name: "rising-falling tone", xsampa: "᷈" },
    // Intonation
    { symbol: "|", name: "minor (foot) group", xsampa: "|" },
    { symbol: "‖", name: "major (intonation) group", xsampa: "||" },
    { symbol: "‿", name: "linking (absence of a break)", xsampa: "-\\" },
    // Other
    { symbol: ".", name: "syllable break", xsampa: "." },
    { symbol: "↗", name: "global rise", xsampa: "<R>" },
    { symbol: "↘", name: "global fall", xsampa: "<F>" },
]

const IPA_CLICKS =  [
    { symbol: "ʘ", name: "bilabial click", xsampa: "O\\" },
    { symbol: "ǀ", name: "dental click", xsampa: "|\\" },
    { symbol: "ǃ", name: "postalveolar click", xsampa: "!\\" },
    { symbol: "ǂ", name: "palatoalveolar click", xsampa: "=\\" },
    { symbol: "ǁ", name: "alveolar lateral click", xsampa: "|\\|\\" },
    // Implosives
    { symbol: "ɓ", name: "voiced bilabial implosive", xsampa: "b_<" },
    { symbol: "ɗ", name: "voiced alveolar implosive", xsampa: "d_<" },
    { symbol: "ʄ", name: "voiced palatal implosive", xsampa: "J\_<" },
    { symbol: "ɠ", name: "voiced velar implosive", xsampa: "g_<" },
    { symbol: "ʛ", name: "voiced uvular implosive", xsampa: "G\_<" },
    // Ejectives (marked with ʼ)
    { symbol: "pʼ", name: "bilabial ejective", xsampa: "pʼ" },
    { symbol: "tʼ", name: "alveolar ejective", xsampa: "tʼ" },
    { symbol: "kʼ", name: "velar ejective", xsampa: "kʼ" },
    { symbol: "sʼ", name: "alveolar fricative ejective", xsampa: "sʼ" },
    // Other clicks
    { symbol: "ǃ˞", name: "retroflex click", xsampa: "ǃ˞" },
]

const IPA_UNCLASSIFIED =  [
    { symbol: "ᶑ", xsampa: "d`_<" },
    { symbol: "ɪ̈", xsampa: "I\\" },
    { symbol: "ʊ̈", xsampa: "U\\" },
    { symbol: "ᴙ", xsampa: "%\\" },
    { symbol: "ꜛ", xsampa: "^" },
    { symbol: "ꜜ", xsampa: "!" },
    { symbol: "‼", xsampa: "!!" },
    { symbol: "͡", xsampa: "__" },
    { symbol: "͈", xsampa: "_:" },
    { symbol: "ǟD", xsampa: "_%\\" },
    { symbol: "̚", xsampa: "_}" },
    { symbol: "ǜ5", xsampa: "_B_L" },
    { symbol: "ǜ4", xsampa: "_H_T" },
    { symbol: "ǜ8", xsampa: "_R_F" },
    { symbol: "◌", xsampa: "0" },
]

//Can be used to speed up conversion by checking for special symbols once in a while
//requires testing to see if any boosting could be expected
const X_SAMPA_LIKE = /_\\A-Z0-9~"'%!#&{\[]}\|<>-\+\^`:@\*/g

const IPA_TOTAL = IPA_CONSONANTS.concat(IPA_VOWELS, IPA_DIACRITICS, IPA_SUPRASEGMENTALS, IPA_CLICKS)
const XSAMPA_IPA = IPA_TOTAL
    //usual symbols like "a" or "s" are skipped
    .filter(entry => entry.symbol !== entry.xsampa)
    //create array of X-SAMPA to IPA correspondences;
    //if a single IPA symbol has multiple X-SAMPA representations, we create a copy for each X-SAMPA
    .map(entry => Array.isArray(entry.xsampa) ?
        entry.xsampa.map(e => [e, entry.symbol]) : [[entry.xsampa, entry.symbol]]).flat(1)
    //bigger X-SAMPAs tested first
    .sort((e1, e2) => e2[0].length - e1[0].length)


const XSAMPA = XSAMPA_IPA.map(entry => entry[0])
const IPA = XSAMPA_IPA.map(entry => entry[1])

const CHECK_EACH = 10;

export function looksLikeXsampa(text: string): boolean {
    return X_SAMPA_LIKE.test(text);
}

export function xSampa2IPA(text: string): string {
    for (let i = 0; i <  XSAMPA.length; i++) {
        //if ( Math.floor(i / CHECK_EACH) * CHECK_EACH === i) {
        //    if (!looksLikeXsampa(text)) break;
        //}
        text = text.replaceAll(XSAMPA[i], IPA[i])
    }
    return text;
}

console.log(xSampa2IPA("tsOpf"))
