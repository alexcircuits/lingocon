"use server"

import { getUserId } from "@/lib/auth-helpers"
import { toActionError } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { checkContentBadges } from "@/app/actions/badge"
import * as articleService from "@/lib/services/article"

// Shared mapping: user-facing messages for validation/domain errors, a generic fallback otherwise.
const handleError = toActionError

function revalidateArticlePaths(langSlug: string, articleSlug?: string) {
  revalidatePath(`/studio/lang/${langSlug}/articles`)
  revalidatePath(`/lang/${langSlug}/articles`)
  if (articleSlug) {
    revalidatePath(`/studio/lang/${langSlug}/articles/${articleSlug}`)
    revalidatePath(`/lang/${langSlug}/articles/${articleSlug}`)
  }
}

export async function createArticle(data: {
  title: string
  excerpt?: string
  content: any
  coverImage?: string
  published?: boolean
  paradigmId?: string | null
  languageId: string
}) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await articleService.createArticle(data, userId)
    if (result.langSlug) {
      revalidateArticlePaths(result.langSlug, result.article.slug)
    }
    if (data.published) {
      checkContentBadges(userId).catch(console.error)
    }
    return { article: result.article }
  } catch (error) {
    return handleError(error, "Failed to create article")
  }
}

export async function updateArticle(
  id: string,
  data: {
    title?: string
    excerpt?: string
    content?: any
    coverImage?: string
    published?: boolean
    paradigmId?: string | null
  }
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await articleService.updateArticle(id, data, userId)
    revalidateArticlePaths(result.langSlug, result.article.slug)
    return { article: result.article }
  } catch (error) {
    return handleError(error, "Failed to update article")
  }
}

export async function publishArticle(id: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await articleService.publishArticle(id, userId)
    revalidateArticlePaths(result.langSlug, result.article.slug)
    checkContentBadges(userId).catch(console.error)
    return { article: result.article }
  } catch (error) {
    return handleError(error, "Failed to publish article")
  }
}

export async function deleteArticle(id: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await articleService.deleteArticle(id, userId)
    revalidateArticlePaths(result.langSlug, result.articleSlug)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete article")
  }
}
