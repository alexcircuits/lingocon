import { describe, it, expect } from "vitest"
import {
  extractSoundChangeConfig,
  deriveForm,
  deriveOptionalForm,
} from "../derive-forms"

describe("extractSoundChangeConfig", () => {
  it("returns null when metadata is empty / missing rules", () => {
    expect(extractSoundChangeConfig(null)).toBeNull()
    expect(extractSoundChangeConfig({})).toBeNull()
    expect(extractSoundChangeConfig({ soundChangeRules: "   " })).toBeNull()
  })

  it("returns null when no rule parses", () => {
    expect(extractSoundChangeConfig({ soundChangeRules: "// just a comment" })).toBeNull()
  })

  it("parses rules from metadata", () => {
    const config = extractSoundChangeConfig({ soundChangeRules: "a > e\nk → tʃ / _i" })
    expect(config).not.toBeNull()
    expect(config!.rules).toHaveLength(2)
    expect(config!.vowels).toBeUndefined()
    expect(config!.consonants).toBeUndefined()
  })

  it("reads phonology overrides only when enabled and non-empty", () => {
    const enabled = extractSoundChangeConfig({
      soundChangeRules: "a > e",
      phonologyOverride: { enabled: true, vowels: ["a", "e"], consonants: ["k"] },
    })
    expect(enabled!.vowels).toEqual(new Set(["a", "e"]))
    expect(enabled!.consonants).toEqual(new Set(["k"]))

    const disabled = extractSoundChangeConfig({
      soundChangeRules: "a > e",
      phonologyOverride: { enabled: false, vowels: ["a"], consonants: ["k"] },
    })
    expect(disabled!.vowels).toBeUndefined()
    expect(disabled!.consonants).toBeUndefined()
  })

  it("parses named sound classes alongside rules", () => {
    const config = extractSoundChangeConfig({
      soundChangeRules: "class K = p t k\nK → ∅ / _#",
    })
    expect(config).not.toBeNull()
    expect(config!.classes).toEqual(new Map([["K", new Set(["p", "t", "k"])]]))
    expect(config!.rules).toHaveLength(1)
  })

  it("returns an empty classes map for class-free rule text (back-compat)", () => {
    const config = extractSoundChangeConfig({ soundChangeRules: "a > e" })!
    expect(config.classes).toEqual(new Map())
  })
})

describe("deriveForm", () => {
  it("applies an unconditional change", () => {
    const config = extractSoundChangeConfig({ soundChangeRules: "a > e" })!
    expect(deriveForm("banana", config)).toBe("benene")
  })

  it("applies intervocalic deletion across adjacent environments", () => {
    const config = extractSoundChangeConfig({ soundChangeRules: "s → ∅ / V_V" })!
    expect(deriveForm("asasa", config)).toBe("aaa")
  })

  it("runs a multi-rule pipeline in order", () => {
    // "kaki" → (k→tʃ/_i) "katʃi" → (a→e) "ketʃi"
    const config = extractSoundChangeConfig({ soundChangeRules: "k → tʃ / _i\na > e" })!
    expect(deriveForm("kaki", config)).toBe("ketʃi")
  })

  it("honors named sound classes: deletes any class member word-finally", () => {
    const config = extractSoundChangeConfig({
      soundChangeRules: "class K = p t k\nK → ∅ / _#",
    })!
    expect(deriveForm("kat", config)).toBe("ka")
    expect(deriveForm("tap", config)).toBe("ta")
    expect(deriveForm("sak", config)).toBe("sa")
  })

  it("still behaves as before for a class-free ruleset (back-compat)", () => {
    const config = extractSoundChangeConfig({ soundChangeRules: "a > e" })!
    expect(deriveForm("banana", config)).toBe("benene")
  })
})

describe("deriveOptionalForm", () => {
  const config = extractSoundChangeConfig({ soundChangeRules: "a > e" })!

  it("preserves null/empty", () => {
    expect(deriveOptionalForm(null, config)).toBeNull()
    expect(deriveOptionalForm(undefined, config)).toBeNull()
    expect(deriveOptionalForm("", config)).toBeNull()
  })

  it("transforms a present form", () => {
    expect(deriveOptionalForm("aba", config)).toBe("ebe")
  })
})
