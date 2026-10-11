/**
 * Server Actions for `Text` records (long-form writing attached to a language).
 *
 * Flow for every mutation:
 * 1. Resolve the caller with `getUserId`.
 * 2. Delegate to `lib/services/text` (authorization via "write:texts", validation, Prisma).
 * 3. `revalidatePath` for both studio and public `/lang/...` URLs.
 */
"use server"

import { getUserId } from "@/lib/auth-helpers"
import { toActionError } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { checkContentBadges } from "@/app/actions/badge"
import * as textService from "@/lib/services/text"
import { toDocumentSaveError } from "@/lib/services/document-revision"

/** Revalidates the lists plus every given text URL — after a rename both the previous and the new
 * slug, so neither keeps serving a cached copy. */
function revalidateTextPaths(langSlug: string, ...textSlugs: (string | undefined)[]) {
  revalidatePath(`/studio/lang/${langSlug}/texts`)
  revalidatePath(`/lang/${langSlug}/texts`)
  for (const textSlug of new Set(textSlugs)) {
    if (!textSlug) continue
    revalidatePath(`/studio/lang/${langSlug}/texts/${textSlug}`)
    revalidatePath(`/lang/${langSlug}/texts/${textSlug}`)
  }
}

export async function createText(data: textService.CreateTextInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const { text, langSlug } = await textService.createText(data, userId)
    if (langSlug) revalidateTextPaths(langSlug, text.slug)
    checkContentBadges(userId).catch(console.error)
    return { text }
  } catch (error) {
    return { ...toActionError(error, "Failed to create text") }
  }
}

/**
 * Saves a text. Returns the saved record — its `slug` changes when a new title produced a new slug,
 * and its `updatedAt` is the revision to send as `expectedUpdatedAt` on the next save. A save
 * against an older revision returns `{ error, conflict: true }` and writes nothing.
 */
export async function updateText(id: string, data: textService.UpdateTextInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const { text, langSlug, previousSlug } = await textService.updateText(id, data, userId)
    revalidateTextPaths(langSlug, text.slug, previousSlug)
    return { text }
  } catch (error) {
    return { ...toDocumentSaveError(error, "Failed to update text") }
  }
}

export async function deleteText(id: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const { langSlug, textSlug } = await textService.deleteText(id, userId)
    revalidateTextPaths(langSlug, textSlug)
    return { success: true as const }
  } catch (error) {
    return { ...toActionError(error, "Failed to delete text") }
  }
}
