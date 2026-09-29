import { describe, it, expect } from "vitest"
import { checkUndefinedSymbols, checkMissingParadigms } from "../validation"

describe("checkUndefinedSymbols", () => {
  const symbols = [{ symbol: "a" }, { symbol: "k" }, { symbol: "sh" }, { symbol: "r", capitalSymbol: "R" }]

  it("flags characters outside the alphabet", () => {
    const warnings = checkUndefinedSymbols([{ lemma: "kaz" }], symbols)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain("z")
  })

  it("accepts digraph symbols, capitals, spaces and punctuation", () => {
    expect(checkUndefinedSymbols([{ lemma: "Rasha ka-ra" }], symbols)).toEqual([])
  })

  it("does not flag every entry when no alphabet is defined yet", () => {
    expect(checkUndefinedSymbols([{ lemma: "anything" }, { lemma: "else" }], [])).toEqual([])
  })

  it("honours diacritic tolerance", () => {
    expect(checkUndefinedSymbols([{ lemma: "ká" }], symbols, { allowsDiacritics: true })).toEqual([])
    expect(checkUndefinedSymbols([{ lemma: "ká" }], symbols)).toHaveLength(1)
  })
})

describe("checkMissingParadigms", () => {
  it("flags entries pointing at paradigms that don't exist", () => {
    expect(checkMissingParadigms([{ lemma: "a", paradigmId: "gone" }, { lemma: "b", paradigmId: "p1" }], [{ id: "p1" }])).toHaveLength(1)
  })
})
