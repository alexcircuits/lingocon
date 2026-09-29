/**
 * Validation for conlang UI translations submitted from the studio translation editor.
 *
 * Values are rendered through next-intl for every visitor who picks that UI language, so a key that
 * does not exist in the English catalogue, or a value whose ICU braces do not balance (which makes
 * the formatter throw and print the raw key), must be rejected at write time.
 */
import en from "@/messages/en.json"

type Messages = { [key: string]: string | Messages }

function flatten(obj: Messages, prefix = "", out = new Set<string>()): Set<string> {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out.add(path)
    else flatten(value, path, out)
  }
  return out
}

const KNOWN_KEYS = flatten(en as Messages)

export const MAX_TRANSLATION_VALUE_LENGTH = 2_000
export const MAX_TRANSLATIONS_PER_REQUEST = 5_000

function bracesBalance(value: string): boolean {
  let depth = 0
  for (const char of value) {
    if (char === "{") depth++
    else if (char === "}" && --depth < 0) return false
  }
  return depth === 0
}

/** Returns the first problem found, or null when every entry is acceptable. */
export function findTranslationProblem(translations: Record<string, string>): string | null {
  const entries = Object.entries(translations)
  if (entries.length > MAX_TRANSLATIONS_PER_REQUEST) return "Too many translations in one request"
  for (const [key, value] of entries) {
    if (!KNOWN_KEYS.has(key)) return `Unknown translation key: ${key.slice(0, 100)}`
    if (value.length > MAX_TRANSLATION_VALUE_LENGTH) return `Translation for ${key} is too long`
    if (!bracesBalance(value)) return `Translation for ${key} has unbalanced { } placeholders`
  }
  return null
}
