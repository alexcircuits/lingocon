import { describe, it, expect, vi, beforeEach } from "vitest"
import { UnauthorizedError, NotFoundError, ValidationError } from "@/lib/errors"

// Hoisted mocks (vi.mock factories run before variable declarations)
const { mockPrisma, mockCanEditLanguage } = vi.hoisted(() => ({
  mockPrisma: {
    dictionaryEntry: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    language: {
      findUnique: vi.fn(),
    },
  },
  mockCanEditLanguage: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/auth-helpers", () => ({
  canEditLanguage: (...args: any[]) => mockCanEditLanguage(...args),
}))

import {
  createEntry,
  updateEntry,
  deleteEntry,
  bulkUpdateEntries,
  bulkDeleteEntries,
  deleteAllEntries,
} from "../dictionary-entry"

const LANGUAGE_ID = "lang-123"
const USER_ID = "user-456"
const ENTRY_ID = "entry-789"

beforeEach(() => {
  vi.clearAllMocks()
  mockCanEditLanguage.mockResolvedValue(true)
})

describe("createEntry", () => {
  const validInput = {
    lemma: "tala",
    gloss: "to speak",
    languageId: LANGUAGE_ID,
  }

  it("creates entry when user can edit", async () => {
    const mockEntry = { id: ENTRY_ID, ...validInput, language: { slug: "test-lang" } }
    mockPrisma.dictionaryEntry.create.mockResolvedValue(mockEntry)

    const result = await createEntry(validInput, USER_ID)

    expect(result).toEqual(mockEntry)
    expect(mockCanEditLanguage).toHaveBeenCalledWith(LANGUAGE_ID, USER_ID)
    expect(mockPrisma.dictionaryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lemma: "tala",
        gloss: "to speak",
        languageId: LANGUAGE_ID,
      }),
      include: { language: { select: { slug: true } } },
    })
  })

  it("throws UnauthorizedError when user cannot edit", async () => {
    mockCanEditLanguage.mockResolvedValue(false)

    await expect(createEntry(validInput, USER_ID)).rejects.toThrow(UnauthorizedError)
  })

  it("throws ZodError for invalid input", async () => {
    const invalidInput = { lemma: "", gloss: "test", languageId: LANGUAGE_ID }

    await expect(createEntry(invalidInput, USER_ID)).rejects.toThrow()
  })

  it("handles optional fields as null", async () => {
    const inputWithOptionals = {
      ...validInput,
      ipa: null,
      partOfSpeech: null,
      etymology: null,
    }
    mockPrisma.dictionaryEntry.create.mockResolvedValue({
      id: ENTRY_ID,
      ...inputWithOptionals,
      language: { slug: "test-lang" },
    })

    await createEntry(inputWithOptionals, USER_ID)

    expect(mockPrisma.dictionaryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipa: null,
        partOfSpeech: null,
        etymology: null,
      }),
      include: { language: { select: { slug: true } } },
    })
  })
})

describe("updateEntry", () => {
  const validInput = {
    id: ENTRY_ID,
    lemma: "tala-updated",
    languageId: LANGUAGE_ID,
  }

  it("updates entry when user can edit", async () => {
    const mockEntry = { id: ENTRY_ID, lemma: "tala-updated", language: { slug: "test-lang" } }
    mockPrisma.dictionaryEntry.update.mockResolvedValue(mockEntry)

    const result = await updateEntry(validInput, USER_ID)

    expect(result).toEqual(mockEntry)
    expect(mockPrisma.dictionaryEntry.update).toHaveBeenCalledWith({
      where: { id: ENTRY_ID },
      data: { lemma: "tala-updated" },
      include: { language: { select: { slug: true } } },
    })
  })

  it("throws UnauthorizedError when user cannot edit", async () => {
    mockCanEditLanguage.mockResolvedValue(false)

    await expect(updateEntry(validInput, USER_ID)).rejects.toThrow(UnauthorizedError)
  })
})

describe("deleteEntry", () => {
  it("deletes entry when user can edit", async () => {
    const mockEntry = {
      id: ENTRY_ID,
      lemma: "tala",
      languageId: LANGUAGE_ID,
      language: { slug: "test-lang" },
    }
    mockPrisma.dictionaryEntry.delete.mockResolvedValue(mockEntry)

    const result = await deleteEntry(ENTRY_ID, LANGUAGE_ID, USER_ID)

    expect(result).toEqual(mockEntry)
    expect(mockPrisma.dictionaryEntry.delete).toHaveBeenCalledWith({
      where: { id: ENTRY_ID },
      include: { language: { select: { slug: true } } },
    })
  })

  it("throws UnauthorizedError when user cannot edit", async () => {
    mockCanEditLanguage.mockResolvedValue(false)

    await expect(deleteEntry(ENTRY_ID, LANGUAGE_ID, USER_ID)).rejects.toThrow(UnauthorizedError)
  })
})

describe("bulkUpdateEntries", () => {
  const entryIds = ["entry-1", "entry-2"]
  const updates = { partOfSpeech: "noun" }

  it("updates all entries when valid", async () => {
    mockPrisma.dictionaryEntry.findMany.mockResolvedValue([{ id: "entry-1" }, { id: "entry-2" }])
    mockPrisma.dictionaryEntry.updateMany.mockResolvedValue({ count: 2 })
    mockPrisma.language.findUnique.mockResolvedValue({ slug: "test-lang" })

    const result = await bulkUpdateEntries(entryIds, updates, LANGUAGE_ID, USER_ID)

    expect(result).toEqual({ count: 2, slug: "test-lang" })
  })

  it("throws NotFoundError when entries don't match", async () => {
    mockPrisma.dictionaryEntry.findMany.mockResolvedValue([{ id: "entry-1" }])

    await expect(bulkUpdateEntries(entryIds, updates, LANGUAGE_ID, USER_ID)).rejects.toThrow(
      NotFoundError
    )
  })

  it("throws UnauthorizedError when user cannot edit", async () => {
    mockCanEditLanguage.mockResolvedValue(false)

    await expect(bulkUpdateEntries(entryIds, updates, LANGUAGE_ID, USER_ID)).rejects.toThrow(
      UnauthorizedError
    )
  })
})

describe("bulkDeleteEntries", () => {
  it("deletes entries and returns count", async () => {
    const entryIds = ["entry-1", "entry-2"]
    mockPrisma.dictionaryEntry.findMany.mockResolvedValue([{ id: "entry-1" }, { id: "entry-2" }])
    mockPrisma.dictionaryEntry.deleteMany.mockResolvedValue({ count: 2 })
    mockPrisma.language.findUnique.mockResolvedValue({ slug: "test-lang" })

    const result = await bulkDeleteEntries(entryIds, LANGUAGE_ID, USER_ID)

    expect(result).toEqual({ count: 2, slug: "test-lang" })
  })

  it("throws ValidationError for empty entryIds", async () => {
    await expect(bulkDeleteEntries([], LANGUAGE_ID, USER_ID)).rejects.toThrow(ValidationError)
  })

  it("throws NotFoundError when entries don't match", async () => {
    mockPrisma.dictionaryEntry.findMany.mockResolvedValue([{ id: "entry-1" }])

    await expect(
      bulkDeleteEntries(["entry-1", "entry-2"], LANGUAGE_ID, USER_ID)
    ).rejects.toThrow(NotFoundError)
  })
})

describe("deleteAllEntries", () => {
  it("deletes all entries for language", async () => {
    mockPrisma.dictionaryEntry.count.mockResolvedValue(50)
    mockPrisma.dictionaryEntry.deleteMany.mockResolvedValue({ count: 50 })
    mockPrisma.language.findUnique.mockResolvedValue({ slug: "test-lang" })

    const result = await deleteAllEntries(LANGUAGE_ID, USER_ID)

    expect(result).toEqual({ count: 50, slug: "test-lang" })
  })

  it("throws ValidationError when no entries exist", async () => {
    mockPrisma.dictionaryEntry.count.mockResolvedValue(0)

    await expect(deleteAllEntries(LANGUAGE_ID, USER_ID)).rejects.toThrow(ValidationError)
  })

  it("throws UnauthorizedError when user cannot edit", async () => {
    mockCanEditLanguage.mockResolvedValue(false)

    await expect(deleteAllEntries(LANGUAGE_ID, USER_ID)).rejects.toThrow(UnauthorizedError)
  })
})
