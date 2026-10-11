import { describe, expect, it } from "vitest"
import { inventorySets, sameSoundChangeInputs, soundChangeInputs } from "../sound-change-inputs"

describe("sound-change inputs derived from language metadata", () => {
  it("uses the enabled phonology override (the key the phonology editor writes)", () => {
    expect(soundChangeInputs({
      soundChangeRules: "a > e",
      phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a", "e"] },
      // Never written by any editor; must not be read.
      phonology: { vowels: ["x"], consonants: ["y"] },
    })).toEqual({ rules: "a > e", vowels: ["a", "e"], consonants: ["t"] })
  })

  it("falls back to the default classes when the override is disabled, empty or malformed", () => {
    const defaults = { rules: "", vowels: null, consonants: null }
    expect(soundChangeInputs({ phonologyOverride: { enabled: false, consonants: ["t"], vowels: ["a"] } })).toEqual(defaults)
    expect(soundChangeInputs({ phonologyOverride: { enabled: true, consonants: [], vowels: [] } })).toEqual(defaults)
    expect(soundChangeInputs({ phonologyOverride: "yes" })).toEqual(defaults)
    expect(soundChangeInputs(null)).toEqual(defaults)
    expect(soundChangeInputs({ soundChangeRules: 42 })).toEqual(defaults)
  })

  it("builds engine sets only for the classes that are set", () => {
    const { vowels, consonants } = inventorySets({ vowels: ["a"], consonants: null })
    expect(vowels).toEqual(new Set(["a"]))
    expect(consonants).toBeUndefined()
  })

  it("compares reviewed inputs exactly", () => {
    const base = { rules: "a > e", vowels: ["a"], consonants: null }
    expect(sameSoundChangeInputs(base, { ...base })).toBe(true)
    expect(sameSoundChangeInputs(base, { ...base, rules: "a > e " })).toBe(false)
    expect(sameSoundChangeInputs(base, { ...base, vowels: ["a", "e"] })).toBe(false)
    expect(sameSoundChangeInputs(base, { ...base, vowels: null })).toBe(false)
    expect(sameSoundChangeInputs(base, { ...base, consonants: [] })).toBe(false)
  })
})
