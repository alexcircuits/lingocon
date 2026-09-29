import { prisma } from "@/lib/prisma"
import { canEditScope } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError, ValidationError } from "@/lib/errors"
import {
  createDictionaryEntrySchema,
  updateDictionaryEntrySchema,
  bulkUpdateDictionaryEntrySchema,
  type CreateDictionaryEntryInput,
  type UpdateDictionaryEntryInput,
} from "@/lib/validations/dictionary-entry"
import { validatePhonotactics } from "@/lib/utils/alphabet-validation"
import { regenerateEntryForms } from "@/lib/services/inflection-service"
import { assertParadigmInLanguage } from "@/lib/services/language-scope"
import {
  asLemmaList,
  removeRelatedReferences,
  renameRelatedReferences,
  syncReciprocalLinks,
} from "@/lib/services/related-words"

/**
 * Callers pass the languageId they are authorized for; the entry must actually live there, or a
 * user could edit/delete any entry by pairing its id with a language they own.
 */
async function getEntryInLanguage(entryId: string, languageId: string) {
  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: entryId },
    select: { languageId: true, lemma: true, relatedWords: true },
  })
  if (!entry || entry.languageId !== languageId) throw new NotFoundError("Dictionary entry", entryId)
  return entry
}

export async function createEntry(input: CreateDictionaryEntryInput, userId: string) {
  const sterilized = JSON.parse(JSON.stringify(input))
  const validated = createDictionaryEntrySchema.parse(sterilized)

  const canEdit = await canEditScope(validated.languageId, userId, "write:dictionary")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }
  await assertParadigmInLanguage(validated.paradigmId, validated.languageId)

  const language = await prisma.language.findUnique({
    where: { id: validated.languageId },
    select: { metadata: true },
  })

  if (language?.metadata) {
    const metadata = language.metadata as any
    const textToValidate = validated.ipa || validated.lemma
    if (metadata.syllableStructure && metadata.consonants && metadata.vowels) {
      if (!validatePhonotactics(textToValidate, metadata.syllableStructure, metadata.consonants, metadata.vowels)) {
        throw new ValidationError(`"${textToValidate}" does not match the language's syllable structure (${metadata.syllableStructure})`)
      }
    }
  }

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.dictionaryEntry.create({
    data: {
      lemma: validated.lemma,
      gloss: validated.gloss,
      ipa: validated.ipa || null,
      audioUrl: validated.audioUrl || null,
      partOfSpeech: validated.partOfSpeech || null,
      etymology: validated.etymology || null,
      relatedWords: validated.relatedWords ? (validated.relatedWords as any) : null,
      notes: validated.notes || null,
      tags: validated.tags ? (validated.tags as any) : null,
      paradigmId: validated.paradigmId || null,
      languageId: validated.languageId,
    },
    include: {
      language: {
        select: { slug: true },
      },
    },
    })
    if (validated.linkBack && validated.relatedWords?.length) {
      await syncReciprocalLinks(tx, {
        languageId: validated.languageId,
        entryId: created.id,
        lemma: created.lemma,
        before: [],
        after: validated.relatedWords,
      })
    }
    return created
  })

  // Materialize this entry's inflected forms from its paradigm's rules (best
  // effort — never let it fail the entry create).
  if (entry.paradigmId) regenerateEntryForms(entry.id).catch(() => {})
  return entry
}

export async function updateEntry(input: UpdateDictionaryEntryInput, userId: string) {
  const sterilized = JSON.parse(JSON.stringify(input))
  const validated = updateDictionaryEntrySchema.parse(sterilized)

  const canEdit = await canEditScope(validated.languageId, userId, "write:dictionary")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }
  const existing = await getEntryInLanguage(validated.id, validated.languageId)
  await assertParadigmInLanguage(validated.paradigmId, validated.languageId)

  const language = await prisma.language.findUnique({
    where: { id: validated.languageId },
    select: { metadata: true },
  })

  if (language?.metadata) {
    const metadata = language.metadata as any
    const textToValidate = validated.ipa !== undefined ? validated.ipa || validated.lemma : validated.lemma
    if (textToValidate && metadata.syllableStructure && metadata.consonants && metadata.vowels) {
      if (!validatePhonotactics(textToValidate, metadata.syllableStructure, metadata.consonants, metadata.vowels)) {
        throw new ValidationError(`"${textToValidate}" does not match the language's syllable structure (${metadata.syllableStructure})`)
      }
    }
  }

  const updateData: Record<string, unknown> = {}
  if (validated.lemma !== undefined) updateData.lemma = validated.lemma
  if (validated.gloss !== undefined) updateData.gloss = validated.gloss
  if (validated.ipa !== undefined) updateData.ipa = validated.ipa || null
  if (validated.audioUrl !== undefined) updateData.audioUrl = validated.audioUrl || null
  if (validated.partOfSpeech !== undefined) updateData.partOfSpeech = validated.partOfSpeech || null
  if (validated.etymology !== undefined) updateData.etymology = validated.etymology || null
  if (validated.relatedWords !== undefined)
    updateData.relatedWords = validated.relatedWords ? (validated.relatedWords as any) : null
  if (validated.notes !== undefined) updateData.notes = validated.notes || null
  if (validated.tags !== undefined) updateData.tags = validated.tags ? (validated.tags as any) : null
  if (validated.paradigmId !== undefined) updateData.paradigmId = validated.paradigmId || null

  const entry = await prisma.$transaction(async (tx) => {
    const updated = await tx.dictionaryEntry.update({
      where: { id: validated.id },
      data: updateData,
      include: {
        language: {
          select: { slug: true },
        },
      },
    })
    // Keep other entries' related-word references pointing at this entry's current spelling.
    await renameRelatedReferences(tx, validated.languageId, existing.lemma, updated.lemma)
    if (validated.linkBack && validated.relatedWords !== undefined) {
      await syncReciprocalLinks(tx, {
        languageId: validated.languageId,
        entryId: updated.id,
        lemma: updated.lemma,
        before: asLemmaList(existing.relatedWords),
        after: validated.relatedWords ?? [],
      })
    }
    return updated
  })

  // The lemma or the linked paradigm may have changed — rematerialize this
  // entry's inflected forms (best effort). regenerateEntryForms also clears
  // stale forms when the paradigm is removed.
  if (validated.paradigmId !== undefined || validated.lemma !== undefined) {
    regenerateEntryForms(entry.id).catch(() => {})
  }
  return entry
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

  const canEdit = await canEditScope(validated.languageId, userId, "write:dictionary")
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
  const canEdit = await canEditScope(languageId, userId, "write:dictionary")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const existing = await getEntryInLanguage(entryId, languageId)

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.dictionaryEntry.delete({
      where: { id: entryId },
      include: {
        language: {
          select: { slug: true },
        },
      },
    })
    await removeRelatedReferences(tx, languageId, [existing.lemma])
    return deleted
  })
}

export async function bulkDeleteEntries(entryIds: string[], languageId: string, userId: string) {
  if (!entryIds || entryIds.length === 0) {
    throw new ValidationError("No entries selected")
  }

  const canEdit = await canEditScope(languageId, userId, "write:dictionary")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const entries = await prisma.dictionaryEntry.findMany({
    where: {
      id: { in: entryIds },
      languageId,
    },
    select: { id: true, lemma: true },
  })

  if (entries.length !== new Set(entryIds).size) {
    throw new NotFoundError("Some entries not found or don't belong to this language")
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.dictionaryEntry.deleteMany({
      where: {
        id: { in: entryIds },
        languageId,
      },
    })
    await removeRelatedReferences(tx, languageId, entries.map((e) => e.lemma))
    return deleted
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

  const canEdit = await canEditScope(languageId, userId, "write:dictionary")
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
