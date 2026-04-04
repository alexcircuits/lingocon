import { prisma } from "@/lib/prisma"
import { canEditLanguage } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError, ValidationError } from "@/lib/errors"
import {
  createDictionaryEntrySchema,
  updateDictionaryEntrySchema,
  bulkUpdateDictionaryEntrySchema,
  type CreateDictionaryEntryInput,
  type UpdateDictionaryEntryInput,
} from "@/lib/validations/dictionary-entry"

export async function createEntry(input: CreateDictionaryEntryInput, userId: string) {
  const sterilized = JSON.parse(JSON.stringify(input))
  const validated = createDictionaryEntrySchema.parse(sterilized)

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  return prisma.dictionaryEntry.create({
    data: {
      lemma: validated.lemma,
      gloss: validated.gloss,
      ipa: validated.ipa || null,
      partOfSpeech: validated.partOfSpeech || null,
      etymology: validated.etymology || null,
      relatedWords: validated.relatedWords ? (validated.relatedWords as any) : null,
      notes: validated.notes || null,
      tags: validated.tags ? (validated.tags as any) : null,
      languageId: validated.languageId,
    },
    include: {
      language: {
        select: { slug: true },
      },
    },
  })
}

export async function updateEntry(input: UpdateDictionaryEntryInput, userId: string) {
  const sterilized = JSON.parse(JSON.stringify(input))
  const validated = updateDictionaryEntrySchema.parse(sterilized)

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const updateData: Record<string, unknown> = {}
  if (validated.lemma !== undefined) updateData.lemma = validated.lemma
  if (validated.gloss !== undefined) updateData.gloss = validated.gloss
  if (validated.ipa !== undefined) updateData.ipa = validated.ipa || null
  if (validated.partOfSpeech !== undefined) updateData.partOfSpeech = validated.partOfSpeech || null
  if (validated.etymology !== undefined) updateData.etymology = validated.etymology || null
  if (validated.relatedWords !== undefined)
    updateData.relatedWords = validated.relatedWords ? (validated.relatedWords as any) : null
  if (validated.notes !== undefined) updateData.notes = validated.notes || null
  if (validated.tags !== undefined) updateData.tags = validated.tags ? (validated.tags as any) : null

  return prisma.dictionaryEntry.update({
    where: { id: validated.id },
    data: updateData,
    include: {
      language: {
        select: { slug: true },
      },
    },
  })
}

export async function bulkUpdateEntries(
  entryIds: string[],
  updates: { partOfSpeech?: string; notes?: string },
  languageId: string,
  userId: string
) {
  const validated = bulkUpdateDictionaryEntrySchema.parse({
    entryIds,
    updates,
    languageId,
  })

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const entries = await prisma.dictionaryEntry.findMany({
    where: {
      id: { in: validated.entryIds },
      languageId: validated.languageId,
    },
    select: { id: true },
  })

  if (entries.length !== validated.entryIds.length) {
    throw new NotFoundError("Some entries not found or don't belong to this language")
  }

  const updateData: Record<string, unknown> = {}
  if (validated.updates.partOfSpeech !== undefined)
    updateData.partOfSpeech = validated.updates.partOfSpeech || null
  if (validated.updates.notes !== undefined) updateData.notes = validated.updates.notes || null

  await prisma.dictionaryEntry.updateMany({
    where: {
      id: { in: validated.entryIds },
      languageId: validated.languageId,
    },
    data: updateData,
  })

  const language = await prisma.language.findUnique({
    where: { id: validated.languageId },
    select: { slug: true },
  })

  return { count: validated.entryIds.length, slug: language?.slug }
}

export async function deleteEntry(entryId: string, languageId: string, userId: string) {
  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  return prisma.dictionaryEntry.delete({
    where: { id: entryId },
    include: {
      language: {
        select: { slug: true },
      },
    },
  })
}

export async function bulkDeleteEntries(entryIds: string[], languageId: string, userId: string) {
  if (!entryIds || entryIds.length === 0) {
    throw new ValidationError("No entries selected")
  }

  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const entries = await prisma.dictionaryEntry.findMany({
    where: {
      id: { in: entryIds },
      languageId,
    },
    select: { id: true },
  })

  if (entries.length !== entryIds.length) {
    throw new NotFoundError("Some entries not found or don't belong to this language")
  }

  const result = await prisma.dictionaryEntry.deleteMany({
    where: {
      id: { in: entryIds },
      languageId,
    },
  })

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { slug: true },
  })

  return { count: result.count, slug: language?.slug }
}

export async function deleteAllEntries(languageId: string, userId: string) {
  if (!languageId) {
    throw new ValidationError("Language ID is required")
  }

  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const totalCount = await prisma.dictionaryEntry.count({
    where: { languageId },
  })

  if (totalCount === 0) {
    throw new ValidationError("No entries to delete")
  }

  const result = await prisma.dictionaryEntry.deleteMany({
    where: { languageId },
  })

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { slug: true },
  })

  return { count: result.count, slug: language?.slug }
}
