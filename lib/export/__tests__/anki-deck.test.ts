import { describe, expect, it } from "vitest"
import { toAnkiCards } from "../anki-deck"

describe("toAnkiCards", () => {
  it("maps lemma to front and gloss to back when no ipa/pos", () => {
    const cards = toAnkiCards([{ lemma: "vand", gloss: "water" }])
    expect(cards).toEqual([{ front: "vand", back: "water" }])
  })

  it("appends ipa to back when present", () => {
    const cards = toAnkiCards([{ lemma: "vand", gloss: "water", ipa: "vanˀ" }])
    expect(cards[0].back).toBe("water /vanˀ/")
  })

  it("appends part of speech to back when present", () => {
    const cards = toAnkiCards([{ lemma: "vand", gloss: "water", partOfSpeech: "noun" }])
    expect(cards[0].back).toBe("water · noun")
  })

  it("appends both ipa and part of speech, in order, when both present", () => {
    const cards = toAnkiCards([
      { lemma: "vand", gloss: "water", ipa: "vanˀ", partOfSpeech: "noun" },
    ])
    expect(cards[0].back).toBe("water /vanˀ/ · noun")
  })

  it("omits ipa when null or empty (no stray slashes)", () => {
    const nullIpa = toAnkiCards([{ lemma: "vand", gloss: "water", ipa: null }])
    expect(nullIpa[0].back).toBe("water")

    const emptyIpa = toAnkiCards([{ lemma: "vand", gloss: "water", ipa: "   " }])
    expect(emptyIpa[0].back).toBe("water")
  })

  it("omits part of speech when null or empty (no stray dots)", () => {
    const nullPos = toAnkiCards([{ lemma: "vand", gloss: "water", partOfSpeech: null }])
    expect(nullPos[0].back).toBe("water")

    const emptyPos = toAnkiCards([{ lemma: "vand", gloss: "water", partOfSpeech: "   " }])
    expect(emptyPos[0].back).toBe("water")
  })

  it("skips entries missing a lemma", () => {
    const cards = toAnkiCards([{ lemma: "", gloss: "water" }])
    expect(cards).toEqual([])
  })

  it("skips entries missing a gloss", () => {
    const cards = toAnkiCards([{ lemma: "vand", gloss: "" }])
    expect(cards).toEqual([])
  })

  it("returns an empty array for empty input", () => {
    expect(toAnkiCards([])).toEqual([])
  })
})
