"use server"

import { getUserId } from "@/lib/auth-helpers"
import { toActionError } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { checkGrammarBadges } from "@/app/actions/badge"
import type { CreateGrammarPageInput } from "@/lib/validations/grammar-page"
import * as grammarService from "@/lib/services/grammar-page"
import { toDocumentSaveError } from "@/lib/services/document-revision"

// Shared mapping: user-facing messages for validation/domain errors, a generic fallback otherwise.
const handleError = toActionError

/** Revalidates the lists plus every given page URL — after a slug change both the previous and
 * the new slug, so neither keeps serving a cached copy. */
function revalidateGrammarPaths(langSlug: string, ...pageSlugs: (string | undefined)[]) {
  revalidatePath(`/studio/lang/${langSlug}/grammar`)
  revalidatePath(`/lang/${langSlug}/grammar`)
  for (const pageSlug of new Set(pageSlugs)) {
    if (!pageSlug) continue
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

/**
 * Saves a grammar page. Returns the saved record — its `updatedAt` is the revision to send as
 * `expectedUpdatedAt` on the next save. A save against an older revision returns
 * `{ error, conflict: true }` and writes nothing.
 */
export async function updateGrammarPage(input: grammarService.UpdateGrammarPageCommand) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const { page, previousSlug } = await grammarService.updatePage(input, userId)
    revalidateGrammarPaths(page.language.slug, page.slug, previousSlug)
    return { success: true as const, data: page }
  } catch (error) {
    return { ...toDocumentSaveError(error, "Failed to update grammar page") }
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
