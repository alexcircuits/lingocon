"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { logAdminAction } from "@/app/actions/admin-audit"

/**
 * Force unpublish an article
 */
export async function forceUnpublishArticle(articleId: string) {
    await requireAdmin()

    const article = await prisma.article.update({
        where: { id: articleId },
        data: {
            published: false,
            publishedAt: null
        },
        include: {
            language: { select: { slug: true } }
        }
    })

    await logAdminAction({
        action: "UNPUBLISH_ARTICLE",
        resource: "ARTICLE",
        resourceId: articleId,
        details: { title: article.title, languageId: article.languageId }
    })

    revalidatePath(`/admin/content`)
    revalidatePath(`/lang/${article.language.slug}/articles`)

    return { success: true, article }
}

/**
 * Force unpublish a text
 */
export async function forceUnpublishText(textId: string) {
    await requireAdmin()

    const text = await prisma.text.update({
        where: { id: textId },
        data: { published: false },
        include: {
            language: { select: { slug: true } }
        }
    })

    await logAdminAction({
        action: "UNPUBLISH_TEXT",
        resource: "TEXT",
        resourceId: textId,
        details: { title: text.title, languageId: text.languageId }
    })

    revalidatePath(`/admin/content`)
    revalidatePath(`/lang/${text.language.slug}/texts`)

    return { success: true, text }
}

/**
 * Force change language visibility
 */
export async function forceLanguageVisibility(
    languageId: string,
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE"
) {
    await requireAdmin()

    const language = await prisma.language.update({
        where: { id: languageId },
        data: { visibility }
    })

    await logAdminAction({
        action: "CHANGE_VISIBILITY",
        resource: "LANGUAGE",
        resourceId: languageId,
        details: { visibility, name: language.name }
    })

    revalidatePath(`/admin/languages`)
    revalidatePath(`/admin/languages/${languageId}`)
    revalidatePath(`/browse`)

    return { success: true, language }
}

/**
 * Get article by ID for admin
 */
export async function getArticleForAdmin(articleId: string) {
    await requireAdmin()

    return prisma.article.findUnique({
        where: { id: articleId },
        include: {
            language: { select: { name: true, slug: true } },
            author: { select: { name: true, email: true } }
        }
    })
}

/**
 * Get text by ID for admin
 */
export async function getTextForAdmin(textId: string) {
    await requireAdmin()

    return prisma.text.findUnique({
        where: { id: textId },
        include: {
            language: { select: { name: true, slug: true } },
            author: { select: { name: true, email: true } }
        }
    })
}
