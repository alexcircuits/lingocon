export const defaultLocale = 'en'
// Natural languages shipped with the platform. Conlangs are loaded dynamically
// from the DB and use the `conlang:<id>` prefix in the cookie.
//   - 'free-ru': "Russian" — modern standard Russian. (The `free-ru` code is
//     retained so existing locale cookies keep working; the display label and
//     content are plain modern Russian.)
//   - 'uk': "Ukrainian" — modern standard Ukrainian.
//   - 'fr': "French" — modern standard French.
export const locales = ['en', 'free-ru', 'uk', 'fr', 'br'] as const
export type Locale = typeof locales[number]

// Built-in interface languages shown in the language switcher, in display order.
// Single source of truth so adding a language is one line here + a label key
// (under the `i18n` message namespace) + a `messages/<code>.json` file.
export interface NaturalLocale {
  code: Locale
  /** Key under the `i18n` message namespace used for the display label. */
  labelKey: string
}

export const naturalLocales: NaturalLocale[] = [
  { code: 'en', labelKey: 'english' },
  { code: 'free-ru', labelKey: 'freeRussian' },
  { code: 'uk', labelKey: 'ukrainian' },
  { code: 'fr', labelKey: 'french' },
  { code: 'br', labelKey: 'breton' },
]

// Cookie name for storing locale preference
export const LOCALE_COOKIE = 'NEXT_LOCALE'

// Maps an app locale (including the legacy `free-ru` code and `conlang:<id>`
// values) to a BCP-47 tag that Intl understands, so numbers/dates are grouped
// and formatted per language — e.g. Russian and Ukrainian group thousands with
// a space (1 234), English with a comma (1,234). Conlangs and unknown values
// fall back to English.
//
// This is also the locale handed to next-intl: `free-ru` and `conlang:<id>` are not valid BCP-47
// tags, and ICU formatting throws on them — which made every translated string with an argument
// ({count}, <accent>…) render as its raw key path for Russian and conlang UIs (GitHub #51).
// Idempotent, so passing an already-mapped tag ("ru") is safe.
export function getIntlLocale(locale: string): string {
  if (locale === 'free-ru' || locale === 'ru') return 'ru'
  if (locale === 'uk') return 'uk'
  if (locale === 'fr') return 'fr'
  if (locale === 'br') return 'br'
  return 'en'
}

// Total translatable key count (used for percentage calculation)
export function getTotalKeyCount(messages: Record<string, any>): number {
  let count = 0;
  for (const key in messages) {
    if (typeof messages[key] === 'object' && messages[key] !== null) {
      count += getTotalKeyCount(messages[key]);
    } else if (typeof messages[key] === 'string') {
      count++;
    }
  }
  return count;
}
