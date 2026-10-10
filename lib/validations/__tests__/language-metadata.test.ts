import { describe, expect, it, vi } from "vitest"
import { parseLanguageMetadata } from "@/lib/validations/language"

describe("parseLanguageMetadata", () => {
  it("returns valid metadata unchanged, including unknown keys", () => {
    const raw = { wordOrder: "SOV", vowels: ["a", "i"], tts: { voiceId: "v", speed: 1 }, custom: { x: 1 } }
    expect(parseLanguageMetadata(raw)).toEqual(raw)
  })

  it.each([null, undefined, "text", 42, ["a"]])("treats non-object metadata %j as empty", (raw) => {
    expect(parseLanguageMetadata(raw)).toEqual({})
  })

  it("drops only the invalid fields of legacy metadata instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const raw = {
      wordOrder: null, // legacy explicit null
      vowels: "a e i", // legacy string instead of array
      consonants: ["p", "t"],
      phonologyOverride: { consonants: ["k"] }, // missing required `enabled`
      soundChangeRules: "s > h / _#",
      tts: { voiceId: "kept" },
    }
    expect(parseLanguageMetadata(raw)).toEqual({
      consonants: ["p", "t"],
      soundChangeRules: "s > h / _#",
      tts: { voiceId: "kept" },
    })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
