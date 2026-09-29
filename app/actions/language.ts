"use server"

import { getUserId } from "@/lib/auth-helpers"
import { toActionError } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { revalidateBrowse, revalidateLanguage } from "@/lib/utils/revalidation"
import { checkLanguageBadges } from "@/app/actions/badge"
import type { CreateLanguageInput, UpdateLanguageInput } from "@/lib/validations/language"
import * as languageService from "@/lib/services/language"
import { prisma } from "@/lib/prisma"

// Shared mapping: user-facing messages for validation/domain errors, a generic fallback otherwise.
const handleError = toActionError

export async function createLanguage(input: CreateLanguageInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const language = await languageService.createLanguage(input, userId)
    revalidatePath("/dashboard")
    revalidateBrowse()
    checkLanguageBadges(userId).catch(console.error)
    return { success: true as const, data: language }
  } catch (error) {
    return handleError(error, "Failed to create language")
  }
}

export async function updateLanguage(input: UpdateLanguageInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    // Get current slug for revalidation if it's changing
    const currentLang = input.slug ? await prisma.language.findUnique({
      where: { id: input.id },
      select: { slug: true }
    }) : null;

    const updated = await languageService.updateLanguage(input, userId)
    revalidatePath("/dashboard")
    revalidateBrowse()
    
    // Revalidate old slug if it changed
    if (currentLang && currentLang.slug !== updated.slug) {
      revalidateLanguage(currentLang.slug)
    }
    
    revalidateLanguage(updated.slug)
    
    if (input.visibility === "PUBLIC") {
      checkLanguageBadges(userId).catch(console.error)
    }
    return { success: true as const, data: updated, slugChanged: currentLang && currentLang.slug !== updated.slug }
  } catch (error) {
    return handleError(error, "Failed to update language")
  }
}

export async function deleteLanguage(languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await languageService.deleteLanguage(languageId, userId)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete language")
  }
}

export async function updateLanguageMetadata(
  languageId: string,
  updates: Record<string, any>
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    await languageService.updateLanguageMetadata(languageId, updates, userId)
    revalidatePath("/studio")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update metadata")
  }
}
