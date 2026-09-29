/**
 * AWS Polly voices offered for IPA pronunciation. Shared by the language settings picker and the
 * /api/pronounce allow-list (clients must not be able to pick arbitrary — e.g. neural-priced — voices).
 */
export const TTS_VOICES = [
  { id: "Joanna", name: "English (US) - Joanna (Default)" },
  { id: "Matthew", name: "English (US) - Matthew" },
  { id: "Amy", name: "English (UK) - Amy" },
  { id: "Brian", name: "English (UK) - Brian" },
  { id: "Giorgio", name: "Italian - Giorgio (Pure Vowels)" },
  { id: "Carla", name: "Italian - Carla" },
  { id: "Conchita", name: "Spanish - Conchita" },
  { id: "Enrique", name: "Spanish - Enrique" },
  { id: "Mathieu", name: "French - Mathieu" },
  { id: "Celine", name: "French - Celine" },
  { id: "Marlene", name: "German - Marlene" },
  { id: "Hans", name: "German - Hans" },
  { id: "Tatyana", name: "Russian - Tatyana" },
  { id: "Maxim", name: "Russian - Maxim" },
  { id: "Takumi", name: "Japanese - Takumi" },
  { id: "Mizuki", name: "Japanese - Mizuki" },
] as const

export const DEFAULT_TTS_VOICE = "Joanna"

export function isAllowedTtsVoice(voiceId: unknown): voiceId is (typeof TTS_VOICES)[number]["id"] {
  return typeof voiceId === "string" && TTS_VOICES.some((voice) => voice.id === voiceId)
}

/**
 * Polly reads IPA through the selected voice's phoneme table, which has no tie bars — a
 * `t͡ʃ` otherwise comes out as a bare `t` (GitHub #53). Strip them; the affricate is still
 * spelled out by its two symbols.
 */
export function normalizeIpaForPolly(ipa: string): string {
  return ipa.replace(/[͜͡]/g, "").normalize("NFC")
}
