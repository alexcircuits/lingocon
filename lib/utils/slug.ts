/**
 * The one URL-slug helper for languages, grammar pages, texts, articles, families and modules.
 *
 * Conlang names are routinely non-ASCII ("Ëlvish", "Tōki", "Бретонский"), so input is folded to
 * ASCII before everything outside [a-z0-9] collapses to single hyphens: diacritics are stripped via
 * Unicode decomposition, and letters that do not decompose (ß, æ, ø, ł, þ…) plus Cyrillic and Greek
 * are transliterated. A title with nothing transliterable (e.g. written only in a constructed
 * script) yields "" — server code that must always produce a slug uses `slugOrFallback`.
 */

const LETTER_MAP: Record<string, string> = {
  // Latin letters without a canonical decomposition
  ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", þ: "th", ł: "l", ħ: "h", ı: "i",
  ŋ: "ng", ŧ: "t", ƒ: "f", ə: "e", ɛ: "e", ɔ: "o", ʃ: "sh", ʒ: "zh",
  // Cyrillic (й/ё/ї/ў arrive here already folded to и/е/і/у by NFKD)
  а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", є: "ye", ж: "zh", з: "z", и: "i",
  і: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r",
  с: "s", т: "t", ћ: "c", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", џ: "dz", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // Greek
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l",
  μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f",
  χ: "ch", ψ: "ps", ω: "o",
}

export const DEFAULT_SLUG_MAX_LENGTH = 100

export function generateSlug(input: string, maxLength = DEFAULT_SLUG_MAX_LENGTH): string {
  const folded = input.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase()

  let ascii = ""
  for (const char of folded) ascii += LETTER_MAP[char] ?? char

  return ascii
    .replace(/['’ʼ]/g, "") // "Tolkien's" → "tolkiens", not "tolkien-s"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, maxLength)
    .replace(/-+$/, "")
}

/** `generateSlug`, or `fallback` when the input has no slug-able characters at all. */
export function slugOrFallback(
  input: string,
  fallback: string,
  maxLength = DEFAULT_SLUG_MAX_LENGTH
): string {
  return generateSlug(input, maxLength) || fallback
}
