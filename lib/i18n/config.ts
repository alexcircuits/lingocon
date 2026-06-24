export const defaultLocale = 'en'
// Natural languages shipped with the platform. Conlangs are loaded dynamically
// from the DB and use the `conlang:<id>` prefix in the cookie.
//   - 'free-ru': "Russian" — modern standard Russian. (The `free-ru` code is
//     retained so existing locale cookies keep working; the display label and
//     content are plain modern Russian.)
//   - 'uk': "Ukrainian" — modern standard Ukrainian.
export const locales = ['en', 'free-ru', 'uk'] as const
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
]

// Cookie name for storing locale preference
export const LOCALE_COOKIE = 'NEXT_LOCALE'

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
