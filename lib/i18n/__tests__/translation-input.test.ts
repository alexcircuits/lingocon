import { describe, it, expect } from "vitest"
import { findTranslationProblem } from "../translation-input"

describe("findTranslationProblem", () => {
  it("accepts known keys with balanced placeholders", () => {
    expect(findTranslationProblem({ "common.save": "Sava", "footer.copyright": "© {year} LingoCon" })).toBeNull()
  })

  it("rejects keys that are not in the English catalogue", () => {
    expect(findTranslationProblem({ "__proto__.polluted": "x" })).toMatch(/Unknown/)
    expect(findTranslationProblem({ "made.up": "x" })).toMatch(/Unknown/)
  })

  it("rejects unbalanced ICU braces", () => {
    expect(findTranslationProblem({ "footer.copyright": "© {year LingoCon" })).toMatch(/unbalanced/)
    expect(findTranslationProblem({ "footer.copyright": "} {year}" })).toMatch(/unbalanced/)
  })

  it("bounds value length", () => {
    expect(findTranslationProblem({ "common.save": "x".repeat(3000) })).toMatch(/too long/)
  })
})
