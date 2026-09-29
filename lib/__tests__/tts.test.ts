import { describe, it, expect } from "vitest"
import { isAllowedTtsVoice, normalizeIpaForPolly } from "@/lib/constants/tts"

describe("TTS helpers", () => {
  it("only allows the offered voices", () => {
    expect(isAllowedTtsVoice("Joanna")).toBe(true)
    expect(isAllowedTtsVoice("Ruth")).toBe(false)
    expect(isAllowedTtsVoice(42)).toBe(false)
  })

  it("strips tie bars Polly cannot read", () => {
    expect(normalizeIpaForPolly("t͡ʃa d͜ʒo")).toBe("tʃa dʒo")
  })
})
