"use server"

import { ZodError } from "zod"
import { getUserId } from "@/lib/auth-helpers"
import { AppError } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { checkGrammarBadges } from "@/app/actions/badge"
import type { CreateGrammarPageInput, UpdateGrammarPageInput } from "@/lib/validations/grammar-page"
import * as grammarService from "@/lib/services/grammar-page"

function handleError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) return { error: error.issues[0]?.message || "Validation failed" }
  if (error instanceof AppError) return { error: error.message }
  if (error instanceof Error) return { error: error.message }
  return { error: fallbackMessage }
}

function revalidateGrammarPaths(langSlug: string, pageSlug?: string) {
  revalidatePath(`/studio/lang/${langSlug}/grammar`)
  revalidatePath(`/lang/${langSlug}/grammar`)
  if (pageSlug) {
    revalidatePath(`/studio/lang/${langSlug}/grammar/${pageSlug}`)
    revalidatePath(`/lang/${langSlug}/grammar/${pageSlug}`)
  }
}

export async function createGrammarPage(input: CreateGrammarPageInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const page = await grammarService.createPage(input, userId)
    revalidateGrammarPaths(page.language.slug, page.slug)
    checkGrammarBadges(userId).catch(console.error)
    return { success: true as const, data: page }
  } catch (error) {
    return handleError(error, "Failed to create grammar page")
  }
}

export async function updateGrammarPage(input: UpdateGrammarPageInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const page = await grammarService.updatePage(input, userId)
    revalidateGrammarPaths(page.language.slug, page.slug)
    return { success: true as const, data: page }
  } catch (error) {
    return handleError(error, "Failed to update grammar page")
  }
}

export async function deleteGrammarPage(pageId: string, languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const page = await grammarService.deletePage(pageId, languageId, userId)
    revalidateGrammarPaths(page.language.slug, page.slug)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete grammar page")
  }
}

export async function reorderGrammarPages(
  pageId: string,
  languageId: string,
  direction: "up" | "down"
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await grammarService.reorderPages(pageId, languageId, direction, userId)
    revalidateGrammarPaths(result.slug)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to reorder grammar pages")
  }
}
