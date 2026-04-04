"use server"

import { ZodError } from "zod"
import { getUserId } from "@/lib/auth-helpers"
import { AppError } from "@/lib/errors"
import { createActivity } from "@/lib/utils/activity"
import { revalidateDictionary } from "@/lib/utils/revalidation"
import { checkDictionaryBadges } from "@/app/actions/badge"
import type { CreateDictionaryEntryInput, UpdateDictionaryEntryInput } from "@/lib/validations/dictionary-entry"
import * as dictionaryService from "@/lib/services/dictionary-entry"

function handleError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return { error: error.issues[0]?.message || "Validation failed" }
  }
  if (error instanceof AppError) {
    return { error: error.message }
  }
  if (error instanceof Error) {
    return { error: error.message }
  }
  return { error: fallbackMessage }
}

export async function createDictionaryEntry(input: CreateDictionaryEntryInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const entry = await dictionaryService.createEntry(input, userId)

    await createActivity({
      type: "CREATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entry.id,
      languageId: entry.languageId,
      userId,
      description: `Added dictionary entry "${entry.lemma}"`,
    })

    revalidateDictionary(entry.language.slug)
    checkDictionaryBadges(userId).catch(console.error)

    return { success: true as const, data: entry }
  } catch (error) {
    return handleError(error, "Failed to create dictionary entry")
  }
}

export async function updateDictionaryEntry(input: UpdateDictionaryEntryInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const entry = await dictionaryService.updateEntry(input, userId)

    await createActivity({
      type: "UPDATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entry.id,
      languageId: entry.languageId,
      userId,
      description: `Updated dictionary entry "${entry.lemma}"`,
    })

    revalidateDictionary(entry.language.slug)

    return { success: true as const, data: entry }
  } catch (error) {
    return handleError(error, "Failed to update dictionary entry")
  }
}

export async function bulkUpdateDictionaryEntries(
  entryIds: string[],
  updates: { partOfSpeech?: string; notes?: string },
  languageId: string
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await dictionaryService.bulkUpdateEntries(entryIds, updates, languageId, userId)

    await createActivity({
      type: "UPDATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entryIds[0],
      languageId,
      userId,
      description: `Bulk updated ${result.count} dictionary entries`,
    })

    if (result.slug) revalidateDictionary(result.slug)

    return { success: true as const, updatedCount: result.count }
  } catch (error) {
    return handleError(error, "Failed to bulk update dictionary entries")
  }
}

export async function deleteDictionaryEntry(entryId: string, languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const entry = await dictionaryService.deleteEntry(entryId, languageId, userId)

    await createActivity({
      type: "DELETED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entryId,
      languageId: entry.languageId,
      userId,
      description: `Deleted dictionary entry "${entry.lemma}"`,
    })

    revalidateDictionary(entry.language.slug)

    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete dictionary entry")
  }
}

export async function bulkDeleteDictionaryEntries(entryIds: string[], languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await dictionaryService.bulkDeleteEntries(entryIds, languageId, userId)

    await createActivity({
      type: "DELETED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entryIds[0],
      languageId,
      userId,
      description: `Bulk deleted ${result.count} dictionary entries`,
    })

    if (result.slug) revalidateDictionary(result.slug)

    return { success: true as const, deletedCount: result.count }
  } catch (error) {
    return handleError(error, "Failed to bulk delete dictionary entries")
  }
}

export async function deleteAllDictionaryEntries(languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await dictionaryService.deleteAllEntries(languageId, userId)

    await createActivity({
      type: "DELETED",
      entityType: "DICTIONARY_ENTRY",
      entityId: languageId,
      languageId,
      userId,
      description: `Deleted all ${result.count} dictionary entries`,
    })

    if (result.slug) revalidateDictionary(result.slug)

    return { success: true as const, deletedCount: result.count }
  } catch (error) {
    return handleError(error, "Failed to delete all dictionary entries")
  }
}
