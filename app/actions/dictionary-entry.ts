"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canReadLanguage } from "@/lib/auth-helpers"
import { getEtymologyNeighborhood, type EtymologyNode } from "@/lib/services/etymology"
import { toActionError } from "@/lib/errors"
import { createActivity } from "@/lib/utils/activity"
import { revalidateDictionary } from "@/lib/utils/revalidation"
import { checkDictionaryBadges } from "@/app/actions/badge"
import type { CreateDictionaryEntryInput, UpdateDictionaryEntryInput } from "@/lib/validations/dictionary-entry"
import * as dictionaryService from "@/lib/services/dictionary-entry"

// Shared mapping: user-facing messages for validation/domain errors, a generic fallback otherwise.
const handleError = toActionError

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

    return { success: true as const, data: { updatedCount: result.count } }
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

    return { success: true as const, data: { deletedCount: result.count } }
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

    return { success: true as const, data: { deletedCount: result.count } }
  } catch (error) {
    return handleError(error, "Failed to delete all dictionary entries")
  }
}

/**
 * Public action — no auth required.
 * Fetches a single dictionary entry with its example sentences for the
 * lazy-load detail sheet in the public dictionary view.
 */
export async function getPublicDictionaryEntry(entryId: string) {
  try {
    const entry = await prisma.dictionaryEntry.findUnique({
      where: { id: entryId },
      include: {
        exampleSentences: { orderBy: { order: "asc" } },
        language: { select: { visibility: true } },
      },
    })

    if (!entry || entry.language.visibility === "PRIVATE") {
      return { error: "Not found" }
    }

    // relatedWords holds lemma strings; resolve them to entries so the reader can open them even
    // when they aren't on the current (paginated) page.
    const relatedLemmas = Array.isArray(entry.relatedWords)
      ? entry.relatedWords.filter((w): w is string => typeof w === "string")
      : []
    const relatedEntries = relatedLemmas.length
      ? await prisma.dictionaryEntry.findMany({
          where: { languageId: entry.languageId, lemma: { in: relatedLemmas } },
          select: { id: true, lemma: true },
          take: 200,
        })
      : []

    return { success: true as const, data: { ...entry, relatedEntries } }
  } catch (error) {
    return handleError(error, "Failed to fetch entry details")
  }
}

/** Entries needed to draw one entry's derivation tree (see lib/services/etymology.ts). */
export async function getEntryEtymology(entryId: string): Promise<EtymologyNode[]> {
  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: entryId },
    select: { languageId: true },
  })
  if (!entry || !(await canReadLanguage(entry.languageId, await getUserId()))) return []
  return getEtymologyNeighborhood(entryId)
}

/**
 * Entry picker search across the whole language (e.g. choosing the second word of a compound —
 * GitHub #25: the wizard used to offer only the 20 entries on the current dictionary page).
 */
export async function searchLanguageEntries(languageId: string, query: string) {
  if (!(await canReadLanguage(languageId, await getUserId()))) return []
  const q = query.trim().slice(0, 200)
  return prisma.dictionaryEntry.findMany({
    where: {
      languageId,
      ...(q
        ? {
            OR: [
              { lemma: { contains: q, mode: "insensitive" } },
              { gloss: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, lemma: true, gloss: true, partOfSpeech: true },
    orderBy: [{ lemma: "asc" }, { id: "asc" }],
    take: 50,
  })
}

/** Every lemma in the language — for the word generator's dedupe and phoneme weighting. */
export async function getLanguageLemmas(languageId: string): Promise<string[]> {
  if (!(await canReadLanguage(languageId, await getUserId()))) return []
  const rows = await prisma.dictionaryEntry.findMany({
    where: { languageId },
    select: { lemma: true },
    take: 100_000,
  })
  return rows.map((r) => r.lemma)
}
