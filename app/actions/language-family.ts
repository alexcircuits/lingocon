"use server"

import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/errors"
import { revalidateFamilies } from "@/lib/utils/revalidation"
import * as familyService from "@/lib/services/language-family"

function handleError(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) return { error: error.message }
  if (error instanceof Error) return { error: error.message }
  return { error: fallbackMessage }
}

export async function setParentLanguage(languageId: string, parentLanguageId: string | null) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.setParentLanguage(languageId, parentLanguageId, userId)
    revalidatePath("/studio")
    revalidatePath("/lang")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update parent language")
  }
}

export async function setExternalAncestry(languageId: string, externalAncestry: string | null) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.setExternalAncestry(languageId, externalAncestry, userId)
    revalidatePath("/studio")
    revalidatePath("/lang")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update external ancestry")
  }
}

export async function getLanguageFamilyTree(languageId: string) {
  const initialLang = await prisma.language.findUnique({
    where: { id: languageId },
    select: { id: true, visibility: true, ownerId: true },
  })
  if (!initialLang) return null

  if (initialLang.visibility === "PRIVATE") {
    const userId = await getUserId()
    if (!userId || userId !== initialLang.ownerId) return null
  }

  return getCachedFamilyTree(languageId)
}

const getCachedFamilyTree = unstable_cache(
  async (languageId: string) => familyService.buildFamilyTree(languageId),
  ["family-tree"],
  { revalidate: 60, tags: ["family-tree"] }
)

export async function createFamily(data: {
  name: string
  description?: string
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC"
  parentFamilyId?: string
}) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const family = await familyService.createFamily(data, userId)
    revalidateFamilies()
    return { success: true as const, family }
  } catch (error) {
    return handleError(error, "Failed to create family")
  }
}

export async function updateFamily(
  familyId: string,
  data: { name?: string; description?: string; visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC" }
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.updateFamily(familyId, data, userId)
    revalidateFamilies()
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update family")
  }
}

export async function deleteFamily(familyId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.deleteFamily(familyId, userId)
    revalidateFamilies()
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete family")
  }
}

export async function setLanguageFamily(languageId: string, familyId: string | null) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.setLanguageFamily(languageId, familyId, userId)
    revalidateFamilies()
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update language family")
  }
}

export async function getUserFamilies() {
  const userId = await getUserId()
  if (!userId) return []

  return familyService.getUserFamilies(userId)
}

export async function searchFamilies(query: string) {
  const userId = await getUserId()
  if (!userId) return { system: [], own: [], public: [] }

  return familyService.searchFamilies(query, userId)
}

export async function searchParentLanguages(languageId: string, query: string) {
  const userId = await getUserId()
  if (!userId) return { own: [], public: [] }

  return familyService.searchParentLanguages(languageId, query, userId)
}

export async function getExternalAncestries(): Promise<string[]> {
  return familyService.getExternalAncestries()
}

export async function deriveWords(
  sourceLanguageId: string,
  targetLanguageId: string,
  entryIds: string[]
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await familyService.deriveWords(sourceLanguageId, targetLanguageId, entryIds, userId)
    revalidateFamilies()
    return { success: true as const, count: result.count }
  } catch (error) {
    return handleError(error, "Failed to derive words")
  }
}

export async function getLanguageDictionary(
  languageId: string,
  query: string,
  page: number = 1,
  pageSize: number = 50
) {
  const userId = await getUserId()
  if (!userId) return { entries: [], total: 0 }

  return familyService.getLanguageDictionary(languageId, query, userId, page, pageSize)
}

export async function getFamilyAncestryPath(familyId: string) {
  return familyService.getFamilyAncestryPath(familyId)
}

export async function getFamilyChildren(familyId: string) {
  return familyService.getFamilyChildren(familyId)
}

export async function setFamilyParent(familyId: string, parentFamilyId: string | null) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.setFamilyParent(familyId, parentFamilyId, userId)
    revalidatePath("/dashboard/families")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update family parent")
  }
}

export async function createProtoWord(
  familyId: string,
  data: { lemma: string; gloss: string; ipa?: string; notes?: string }
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const word = await familyService.createProtoWord(familyId, data, userId)
    revalidatePath("/dashboard/families")
    return { success: true as const, word }
  } catch (error) {
    return handleError(error, "Failed to create proto-word")
  }
}

export async function deleteProtoWord(protoWordId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await familyService.deleteProtoWord(protoWordId, userId)
    revalidatePath("/dashboard/families")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete proto-word")
  }
}

export async function getProtoVocabulary(
  familyId: string,
  query: string,
  page: number = 1,
  pageSize: number = 50
) {
  return familyService.getProtoVocabulary(familyId, query, page, pageSize)
}

export async function deriveFromProto(protoWordIds: string[], targetLanguageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await familyService.deriveFromProto(protoWordIds, targetLanguageId, userId)
    revalidateFamilies()
    return { success: true as const, count: result.count }
  } catch (error) {
    return handleError(error, "Failed to derive from proto-vocabulary")
  }
}
