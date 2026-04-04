import { describe, it, expect } from "vitest"
import {
  createDictionaryEntrySchema,
  updateDictionaryEntrySchema,
  bulkUpdateDictionaryEntrySchema,
} from "../dictionary-entry"

describe("createDictionaryEntrySchema", () => {
  const validInput = {
    lemma: "tala",
    gloss: "to speak",
    languageId: "lang-123",
  }

  it("accepts valid minimal input", () => {
    const result = createDictionaryEntrySchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("accepts valid full input", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      ipa: "/tala/",
      partOfSpeech: "verb",
      etymology: "From Proto-Lang *tal-",
      relatedWords: ["tali", "talak"],
      notes: "Commonly used in formal speech",
      tags: ["formal", "speech"],
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty lemma", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      lemma: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty gloss", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      gloss: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing languageId", () => {
    const result = createDictionaryEntrySchema.safeParse({
      lemma: "tala",
      gloss: "to speak",
    })
    expect(result.success).toBe(false)
  })

  it("rejects lemma over 200 characters", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      lemma: "a".repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it("rejects gloss over 500 characters", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      gloss: "a".repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it("rejects more than 20 tags", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    })
    expect(result.success).toBe(false)
  })

  it("rejects tag over 50 characters", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      tags: ["a".repeat(51)],
    })
    expect(result.success).toBe(false)
  })

  it("accepts nullable optional fields", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      ipa: null,
      partOfSpeech: null,
      etymology: null,
      relatedWords: null,
      notes: null,
      tags: null,
    })
    expect(result.success).toBe(true)
  })

  it("accepts boundary-length lemma (200 chars)", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      lemma: "a".repeat(200),
    })
    expect(result.success).toBe(true)
  })

  it("rejects etymology over 1000 characters", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      etymology: "a".repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it("rejects notes over 2000 characters", () => {
    const result = createDictionaryEntrySchema.safeParse({
      ...validInput,
      notes: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe("updateDictionaryEntrySchema", () => {
  const validInput = {
    id: "entry-123",
    languageId: "lang-123",
  }

  it("accepts update with only required fields", () => {
    const result = updateDictionaryEntrySchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("accepts partial update (just lemma)", () => {
    const result = updateDictionaryEntrySchema.safeParse({
      ...validInput,
      lemma: "tala-new",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing id", () => {
    const result = updateDictionaryEntrySchema.safeParse({
      languageId: "lang-123",
      lemma: "test",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing languageId", () => {
    const result = updateDictionaryEntrySchema.safeParse({
      id: "entry-123",
      lemma: "test",
    })
    expect(result.success).toBe(false)
  })

  it("applies same max-length constraints as create schema", () => {
    const result = updateDictionaryEntrySchema.safeParse({
      ...validInput,
      lemma: "a".repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

describe("bulkUpdateDictionaryEntrySchema", () => {
  it("accepts valid bulk update", () => {
    const result = bulkUpdateDictionaryEntrySchema.safeParse({
      entryIds: ["entry-1", "entry-2"],
      updates: { partOfSpeech: "noun" },
      languageId: "lang-123",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty entryIds", () => {
    const result = bulkUpdateDictionaryEntrySchema.safeParse({
      entryIds: [],
      updates: { partOfSpeech: "noun" },
      languageId: "lang-123",
    })
    expect(result.success).toBe(false)
  })

  it("accepts nullable update fields", () => {
    const result = bulkUpdateDictionaryEntrySchema.safeParse({
      entryIds: ["entry-1"],
      updates: { partOfSpeech: null, notes: null },
      languageId: "lang-123",
    })
    expect(result.success).toBe(true)
  })

  it("accepts empty updates object", () => {
    const result = bulkUpdateDictionaryEntrySchema.safeParse({
      entryIds: ["entry-1"],
      updates: {},
      languageId: "lang-123",
    })
    expect(result.success).toBe(true)
  })
})
