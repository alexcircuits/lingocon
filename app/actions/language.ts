"use server"

import { canViewLanguage, getUserId } from "@/lib/auth-helpers"
import { findReservedSlugTarget } from "@/lib/services/slug-reservation"
import { parseProjectPath, withRenamedSlug } from "@/lib/project-path"
import { toActionError } from "@/lib/errors"
import { revalidatePath, revalidateTag } from "next/cache"
import {
  revalidateBrowse,
  revalidateFamilies,
  revalidateLanguage,
  revalidateStudio,
} from "@/lib/utils/revalidation"
import { checkLanguageBadges } from "@/app/actions/badge"
import type { CreateLanguageInput, UpdateLanguageInput } from "@/lib/validations/language"
import * as languageService from "@/lib/services/language"
import { prisma } from "@/lib/prisma"

// Shared mapping: user-facing messages for validation/domain errors, a generic fallback otherwise.
const handleError = toActionError

/**
 * Where an old studio path of a renamed project lives now (same section), or null.
 * Used by the studio's not-found view: links in a tab opened before the rename, and
 * in-app navigations that do not re-run the project layout, land on not-found
 * instead of the layout's redirect. Only answers for viewers allowed to see the
 * project, so a private project's new slug is not revealed.
 */
export async function findRenamedStudioPath(pathname: string): Promise<string | null> {
  if (typeof pathname !== "string" || pathname.length > 2_000) return null
  const parsed = parseProjectPath(pathname)
  if (!parsed || parsed.prefix !== "/studio/lang") return null
  const target = await findReservedSlugTarget(parsed.slug)
  if (!target) return null
  const language = await prisma.language.findUnique({ where: { slug: target }, select: { id: true } })
  if (!language) return null
  if (process.env.DEV_MODE !== "true" && !(await canViewLanguage(language.id, await getUserId()))) return null
  return withRenamedSlug(pathname, "/studio/lang", parsed.slug, target)
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
    const { slug } = await languageService.deleteLanguage(languageId, userId)
    // Every listing that showed the project, plus its own routes, so neither a listing nor a back
    // navigation renders the deleted project from a cached payload.
    revalidateStudio()
    revalidateBrowse()
    revalidateFamilies()
    revalidatePath(`/studio/lang/${slug}`, "layout")
    revalidatePath(`/lang/${slug}`, "layout")
    revalidateTag("languages")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete language")
  }
}

/**
 * Save a metadata patch: only the keys sent are written, merged atomically into the stored
 * document (see languageService.updateLanguageMetadata). Editors send only the keys they own.
 */
export async function updateLanguageMetadata(
  languageId: string,
  updates: Record<string, unknown>
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const { slug } = await languageService.updateLanguageMetadata(languageId, updates, userId)
    // Phonology, sound changes and settings all read metadata; refresh every route of the project.
    revalidatePath("/studio")
    revalidatePath(`/studio/lang/${slug}`, "layout")
    revalidatePath(`/lang/${slug}`, "layout")
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to update metadata")
  }
}
