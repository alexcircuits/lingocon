import fs from "node:fs"
import path from "node:path"
import { describe, it, expect } from "vitest"
import { locales, defaultLocale } from "@/lib/i18n/config"

// Guards every built-in interface locale against the English source of truth.
// Adding a locale (e.g. `fr`) to `locales` automatically pulls it into these
// checks — there is no per-locale boilerplate to remember.

type Messages = Record<string, unknown>

function loadMessages(code: string): Messages {
  const file = path.join(process.cwd(), "messages", `${code}.json`)
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Messages
}

// Flattens a nested message object into dot-notation string keys.
function flatten(obj: Messages, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object") {
      flatten(value as Messages, path, out)
    } else if (typeof value === "string") {
      out[path] = value
    }
  }
  return out
}

// Extracts the set of ICU *argument* names from a message string, e.g. `name`
// and `count` from "Hi {name}, {count, plural, one {x} other {y}}". Literal
// sub-messages inside plural/select blocks (the `{x}` / `{y}`) are skipped, so
// translated plural wording does not produce false placeholder mismatches.
function placeholders(str: string): Set<string> {
  const names = new Set<string>()
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== "{") continue
    let j = i + 1
    while (j < str.length && /\s/.test(str[j])) j++
    const start = j
    while (j < str.length && /\w/.test(str[j])) j++
    const name = str.slice(start, j)
    let k = j
    while (k < str.length && /\s/.test(str[k])) k++
    if (str[k] === "}") {
      if (name) names.add(name)
    } else if (str[k] === ",") {
      if (name) names.add(name)
      // Skip the complex placeholder body so nested literals are not counted.
      let depth = 1
      let p = k + 1
      while (p < str.length && depth > 0) {
        if (str[p] === "{") depth++
        else if (str[p] === "}") depth--
        p++
      }
      i = p - 1
    }
  }
  return names
}

const reference = flatten(loadMessages(defaultLocale))
const referenceKeys = Object.keys(reference).sort()
const otherLocales = locales.filter((code) => code !== defaultLocale)

describe("interface locales", () => {
  it("ships translations for every non-default locale", () => {
    expect(otherLocales.length).toBeGreaterThan(0)
    for (const code of otherLocales) {
      expect(() => loadMessages(code)).not.toThrow()
    }
  })

  describe.each(otherLocales)("%s.json", (code) => {
    const messages = flatten(loadMessages(code))
    const keys = Object.keys(messages).sort()

    it("has exactly the same keys as the English source", () => {
      const missing = referenceKeys.filter((k) => !(k in messages))
      const extra = keys.filter((k) => !(k in reference))
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it("preserves every ICU placeholder argument", () => {
      const mismatches: Array<{ key: string; expected: string[]; actual: string[] }> = []
      for (const key of referenceKeys) {
        if (!(key in messages)) continue
        const expected = [...placeholders(reference[key])].sort()
        const actual = [...placeholders(messages[key])].sort()
        if (expected.join("|") !== actual.join("|")) {
          mismatches.push({ key, expected, actual })
        }
      }
      expect(mismatches).toEqual([])
    })
  })
})

describe("next-intl locale tags (GitHub #51)", () => {
  it("maps every shipped locale and conlang cookies to a valid BCP-47 tag", async () => {
    const { getIntlLocale } = await import("@/lib/i18n/config")
    for (const code of [...locales, "conlang:abc123", "garbage"]) {
      const tag = getIntlLocale(code)
      expect(() => Intl.getCanonicalLocales(tag)).not.toThrow()
      expect(() => new Intl.PluralRules(tag)).not.toThrow()
    }
    expect(getIntlLocale("free-ru")).toBe("ru")
    expect(getIntlLocale(getIntlLocale("free-ru"))).toBe("ru")
  })
})
