"use server"

import { ZodError } from "zod"
import { getUserId } from "@/lib/auth-helpers"
import { AppError } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { revalidateBrowse, revalidateLanguage } from "@/lib/utils/revalidation"
import { checkLanguageBadges } from "@/app/actions/badge"
import type { CreateLanguageInput, UpdateLanguageInput } from "@/lib/validations/language"
import * as languageService from "@/lib/services/language"

function handleError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) return { error: error.issues[0]?.message || "Validation failed" }
  if (error instanceof AppError) return { error: error.message }
  if (error instanceof Error) return { error: error.message }
  return { error: fallbackMessage }
}

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
    const updated = await languageService.updateLanguage(input, userId)
    revalidatePath("/dashboard")
    revalidateBrowse()
    revalidateLanguage(updated.slug)
    if (input.visibility === "PUBLIC") {
      checkLanguageBadges(userId).catch(console.error)
    }
    return { success: true as const, data: updated }
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
