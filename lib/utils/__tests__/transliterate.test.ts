import { describe, it, expect } from "vitest"
import type { ScriptSymbol } from "@prisma/client"
import { transliterateToLatin } from "../transliterate"

/** Build a full ScriptSymbol record from the few fields the transliterator uses. */
function sym(symbol: string, latin: string | null, capitalSymbol: string | null = null): ScriptSymbol {
  return {
    id: symbol,
    symbol,
    capitalSymbol,
    ipa: null,
    latin,
    name: null,
    order: 0,
    languageId: "lang",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe("transliterateToLatin", () => {
  it("returns text unchanged when there are no symbols", () => {
    expect(transliterateToLatin("hello", [])).toBe("hello")
  })

  it("maps base symbols and passes through unmapped characters", () => {
    const symbols = [sym("ш", "sh"), sym("а", "a")]
    expect(transliterateToLatin("ша?", symbols)).toBe("sha?")
  })

  it("maps the capital form to the same latin (the 'C' for 'sh' case)", () => {
    const symbols = [sym("c", "sh", "C"), sym("a", "a")]
    expect(transliterateToLatin("Ca", symbols)).toBe("sha")
    expect(transliterateToLatin("ca", symbols)).toBe("sha")
  })
})
