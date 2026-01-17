"use server"

import { ZodError } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import {
  createDictionaryEntrySchema,
  updateDictionaryEntrySchema,
  bulkUpdateDictionaryEntrySchema,
  type CreateDictionaryEntryInput,
  type UpdateDictionaryEntryInput,
} from "@/lib/validations/dictionary-entry"
import { createActivity } from "@/lib/utils/activity"
import { checkDictionaryBadges } from "@/app/actions/badge"

export async function createDictionaryEntry(input: CreateDictionaryEntryInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const sterilizedInput = JSON.parse(JSON.stringify(input))
    const validated = createDictionaryEntrySchema.parse(sterilizedInput)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const entry = await prisma.dictionaryEntry.create({
      data: {
        lemma: validated.lemma,
        gloss: validated.gloss,
        ipa: validated.ipa || null,
        partOfSpeech: validated.partOfSpeech || null,
        etymology: validated.etymology || null,
        relatedWords: validated.relatedWords ? (validated.relatedWords as any) : null,
        notes: validated.notes || null,
        languageId: validated.languageId,
      },
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    // Log activity
    await createActivity({
      type: "CREATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entry.id,
      languageId: validated.languageId,
      userId,
      description: `Added dictionary entry "${validated.lemma}"`,
    })

    revalidatePath(`/studio/lang/${entry.language.slug}/dictionary`)
    revalidatePath(`/lang/${entry.language.slug}/dictionary`)

    // Check for dictionary-related badge achievements
    checkDictionaryBadges(userId).catch(console.error)

    return {
      success: true,
      data: entry,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to create dictionary entry",
    }
  }
}

export async function updateDictionaryEntry(input: UpdateDictionaryEntryInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const sterilizedInput = JSON.parse(JSON.stringify(input))
    const validated = updateDictionaryEntrySchema.parse(sterilizedInput)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const updateData: any = {}
    if (validated.lemma !== undefined) updateData.lemma = validated.lemma
    if (validated.gloss !== undefined) updateData.gloss = validated.gloss
    if (validated.ipa !== undefined) updateData.ipa = validated.ipa || null
    if (validated.partOfSpeech !== undefined)
      updateData.partOfSpeech = validated.partOfSpeech || null
    if (validated.etymology !== undefined)
      updateData.etymology = validated.etymology || null
    if (validated.relatedWords !== undefined)
      updateData.relatedWords = validated.relatedWords ? (validated.relatedWords as any) : null
    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    const entry = await prisma.dictionaryEntry.update({
      where: { id: validated.id },
      data: updateData,
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    // Log activity
    await createActivity({
      type: "UPDATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entry.id,
      languageId: entry.languageId,
      userId,
      description: `Updated dictionary entry "${entry.lemma}"`,
    })

    revalidatePath(`/studio/lang/${entry.language.slug}/dictionary`)
    revalidatePath(`/lang/${entry.language.slug}/dictionary`)

    return {
      success: true,
      data: entry,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to update dictionary entry",
    }
  }
}

export async function bulkUpdateDictionaryEntries(
  entryIds: string[],
  updates: { partOfSpeech?: string; notes?: string },
  languageId: string
) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = bulkUpdateDictionaryEntrySchema.parse({
      entryIds,
      updates,
      languageId,
    })

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    // Verify all entries belong to this language
    const entries = await prisma.dictionaryEntry.findMany({
      where: {
        id: { in: validated.entryIds },
        languageId: validated.languageId,
      },
      select: { id: true },
    })

    if (entries.length !== validated.entryIds.length) {
      return {
        error: "Some entries not found or don't belong to this language",
      }
    }

    const updateData: any = {}
    if (validated.updates.partOfSpeech !== undefined)
      updateData.partOfSpeech = validated.updates.partOfSpeech || null
    if (validated.updates.notes !== undefined)
      updateData.notes = validated.updates.notes || null

    await prisma.dictionaryEntry.updateMany({
      where: {
        id: { in: validated.entryIds },
        languageId: validated.languageId,
      },
      data: updateData,
    })

    const language = await prisma.language.findUnique({
      where: { id: validated.languageId },
      select: { slug: true }
    })

    // Log activity
    await createActivity({
      type: "UPDATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: validated.entryIds[0], // Use first ID as representative
      languageId: validated.languageId,
      userId,
      description: `Bulk updated ${validated.entryIds.length} dictionary entries`,
    })

    if (language) {
      revalidatePath(`/studio/lang/${language.slug}/dictionary`)
      revalidatePath(`/lang/${language.slug}/dictionary`)
    }

    return {
      success: true,
      updatedCount: validated.entryIds.length,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to bulk update dictionary entries",
    }
  }
}

export async function deleteDictionaryEntry(entryId: string, languageId: string) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const entry = await prisma.dictionaryEntry.delete({
      where: { id: entryId },
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    // Log activity
    if (entry) {
      await createActivity({
        type: "DELETED",
        entityType: "DICTIONARY_ENTRY",
        entityId: entryId,
        languageId: entry.languageId,
        userId,
        description: `Deleted dictionary entry "${entry.lemma}"`,
      })
    }

    revalidatePath(`/studio/lang/${entry.language.slug}/dictionary`)
    revalidatePath(`/lang/${entry.language.slug}/dictionary`)

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to delete dictionary entry",
    }
  }
}

