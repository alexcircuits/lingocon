import { describe, it, expect, vi, beforeEach } from "vitest"
import { UnauthorizedError, NotFoundError, ValidationError } from "@/lib/errors"

// Hoisted mocks (vi.mock factories run before variable declarations)
const { mockPrisma, mockCanEditScope } = vi.hoisted(() => {
  const mockPrisma: Record<string, any> = {
    dictionaryEntry: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    language: {
      findUnique: vi.fn(),
    },
    paradigm: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  }
  // Interactive transactions run against the same mock client.
  mockPrisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma))
  return { mockPrisma, mockCanEditScope: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/auth-helpers", () => ({
  canEditScope: (...args: any[]) => mockCanEditScope(...args),
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
  mockCanEditScope.mockResolvedValue(true)
  mockPrisma.$queryRaw.mockResolvedValue([])
  mockPrisma.dictionaryEntry.findMany.mockResolvedValue([])
  // By default the entry being edited lives in the language the caller is authorized for.
  mockPrisma.dictionaryEntry.findUnique.mockResolvedValue({
    languageId: LANGUAGE_ID,
    lemma: "tala",
    relatedWords: null,
  })
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
    expect(mockCanEditScope).toHaveBeenCalledWith(LANGUAGE_ID, USER_ID, "write:dictionary")
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
    mockCanEditScope.mockResolvedValue(false)

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
    mockCanEditScope.mockResolvedValue(false)

    await expect(updateEntry(validInput, USER_ID)).rejects.toThrow(UnauthorizedError)
  })

  it("refuses to edit an entry that belongs to another language (IDOR)", async () => {
    // Caller owns LANGUAGE_ID but targets an entry id from someone else's language.
    mockPrisma.dictionaryEntry.findUnique.mockResolvedValue({
      languageId: "victim-lang",
      lemma: "x",
      relatedWords: null,
    })

    await expect(updateEntry(validInput, USER_ID)).rejects.toThrow(NotFoundError)
    expect(mockPrisma.dictionaryEntry.update).not.toHaveBeenCalled()
  })

  it("refuses a paradigm from another language", async () => {
    mockPrisma.paradigm.findUnique.mockResolvedValue({ languageId: "victim-lang" })

    await expect(
      updateEntry({ ...validInput, paradigmId: "foreign-paradigm" }, USER_ID)
    ).rejects.toThrow(NotFoundError)
    expect(mockPrisma.dictionaryEntry.update).not.toHaveBeenCalled()
  })

  it("adds the back-link on newly related entries when linkBack is set (#65)", async () => {
    mockPrisma.dictionaryEntry.update.mockResolvedValue({
      id: ENTRY_ID,
      lemma: "tala",
      language: { slug: "test-lang" },
    })
    mockPrisma.dictionaryEntry.findMany.mockImplementation(async (args: any) =>
      args?.where?.lemma?.in ? [{ id: "e-kora", lemma: "kora", relatedWords: ["mira"] }] : []
    )

    await updateEntry(
      { id: ENTRY_ID, languageId: LANGUAGE_ID, relatedWords: ["kora"], linkBack: true },
      USER_ID
    )

    expect(mockPrisma.dictionaryEntry.update).toHaveBeenCalledWith({
      where: { id: "e-kora" },
      data: { relatedWords: ["mira", "tala"] },
    })
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
    mockCanEditScope.mockResolvedValue(false)

    await expect(deleteEntry(ENTRY_ID, LANGUAGE_ID, USER_ID)).rejects.toThrow(UnauthorizedError)
  })

  it("refuses to delete an entry that belongs to another language (IDOR)", async () => {
    mockPrisma.dictionaryEntry.findUnique.mockResolvedValue({
      languageId: "victim-lang",
      lemma: "x",
      relatedWords: null,
    })

    await expect(deleteEntry(ENTRY_ID, LANGUAGE_ID, USER_ID)).rejects.toThrow(NotFoundError)
    expect(mockPrisma.dictionaryEntry.delete).not.toHaveBeenCalled()
  })

  it("scrubs the deleted lemma from other entries' related words", async () => {
    mockPrisma.dictionaryEntry.delete.mockResolvedValue({ id: ENTRY_ID, language: { slug: "s" } })
    // No homonym survives, and one entry still lists "tala" as related.
    mockPrisma.dictionaryEntry.findMany.mockResolvedValue([])
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "e-2", relatedWords: ["tala", "kora"] }])

    await deleteEntry(ENTRY_ID, LANGUAGE_ID, USER_ID)

    expect(mockPrisma.dictionaryEntry.update).toHaveBeenCalledWith({
      where: { id: "e-2" },
      data: { relatedWords: ["kora"] },
    })
  })

  it("keeps references when a homonym with the same lemma survives", async () => {
    mockPrisma.dictionaryEntry.delete.mockResolvedValue({ id: ENTRY_ID, language: { slug: "s" } })
    mockPrisma.dictionaryEntry.findMany.mockResolvedValue([{ lemma: "tala" }])

    await deleteEntry(ENTRY_ID, LANGUAGE_ID, USER_ID)

    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
    expect(mockPrisma.dictionaryEntry.update).not.toHaveBeenCalled()
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
    mockCanEditScope.mockResolvedValue(false)

    await expect(bulkUpdateEntries(entryIds, updates, LANGUAGE_ID, USER_ID)).rejects.toThrow(
      UnauthorizedError
    )
  })
})

describe("bulkDeleteEntries", () => {
  it("deletes entries and returns count", async () => {
    const entryIds = ["entry-1", "entry-2"]
    mockPrisma.dictionaryEntry.findMany.mockResolvedValueOnce([
      { id: "entry-1", lemma: "a" },
      { id: "entry-2", lemma: "b" },
    ])
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
    mockCanEditScope.mockResolvedValue(false)

    await expect(deleteAllEntries(LANGUAGE_ID, USER_ID)).rejects.toThrow(UnauthorizedError)
  })
})
