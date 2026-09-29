"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canReadLanguage } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createActivity } from "@/lib/utils/activity"
import { createNotification } from "@/lib/notifications"

const createCommentSchema = z.object({
    content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment is too long"),
    languageId: z.string().min(1),
    parentId: z.string().optional(),
})

export async function createComment(input: z.infer<typeof createCommentSchema>) {
    const userId = await getUserId()
    if (!userId) return { error: "You must be signed in to comment" }

    try {
        const validated = createCommentSchema.parse(input)

        // Verify language is public
        const language = await prisma.language.findUnique({
            where: { id: validated.languageId },
            select: { visibility: true, slug: true, ownerId: true, name: true },
        })

        if (!language || language.visibility !== "PUBLIC") {
            return { error: "Comments are only available on public languages" }
        }

        // If replying, verify parent exists and belongs to same language
        let parentAuthorId: string | null = null
        if (validated.parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: validated.parentId },
                select: { languageId: true, userId: true },
            })
            if (!parent || parent.languageId !== validated.languageId) {
                return { error: "Invalid parent comment" }
            }
            parentAuthorId = parent.userId
        }

        const comment = await prisma.comment.create({
            data: {
                content: validated.content,
                languageId: validated.languageId,
                userId,
                parentId: validated.parentId || null,
            },
            include: {
                user: {
                    select: { id: true, name: true, image: true },
                },
            },
        })

        revalidatePath(`/lang/${language.slug}`)

        // Create activity notification for language owner
        await createActivity({
            type: "CREATED",
            entityType: "COMMENT",
            entityId: comment.id,
            languageId: validated.languageId,
            userId,
            description: `New comment on ${language.name}`,
            metadata: {
                commentPreview: validated.content.substring(0, 100),
                commenterName: comment.user.name || "Anonymous",
                isReply: !!validated.parentId,
            },
        })

        // Personal notifications (best-effort; createNotification skips self).
        const excerpt = validated.content.substring(0, 140)
        const actorName = comment.user.name || "Someone"
        const actorImage = comment.user.image ?? null
        const href = `/lang/${language.slug}`

        if (parentAuthorId) {
            // Reply → notify the parent comment's author.
            await createNotification({
                recipientId: parentAuthorId,
                type: "COMMENT_REPLY",
                actorId: userId,
                languageId: validated.languageId,
                entityId: comment.id,
                data: { actorName, actorImage, languageName: language.name, languageSlug: language.slug, excerpt, href },
            })
        }
        // Always notify the language owner of a new comment (skips self, and
        // skips when the owner is the same person we just replied to).
        if (language.ownerId !== parentAuthorId) {
            await createNotification({
                recipientId: language.ownerId,
                type: "NEW_COMMENT",
                actorId: userId,
                languageId: validated.languageId,
                entityId: comment.id,
                data: { actorName, actorImage, languageName: language.name, languageSlug: language.slug, excerpt, href },
            })
        }

        return { success: true, data: comment }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0]?.message || "Validation failed" }
        }
        return { error: "Failed to post comment" }
    }
}

export async function deleteComment(commentId: string) {
    const userId = await getUserId()
    if (!userId) return { error: "Unauthorized" }

    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
            language: { select: { ownerId: true, slug: true } },
        },
    })

    if (!comment) return { error: "Comment not found" }

    // Allow deletion by comment author or language owner
    if (comment.userId !== userId && comment.language.ownerId !== userId) {
        return { error: "You can only delete your own comments" }
    }

    await prisma.comment.delete({ where: { id: commentId } })

    revalidatePath(`/lang/${comment.language.slug}`)

    return { success: true }
}

export async function hideComment(commentId: string, languageId: string) {
    const userId = await getUserId()
    if (!userId) return { error: "Unauthorized" }

    // Only language owner can hide comments
    const language = await prisma.language.findUnique({
        where: { id: languageId },
        select: { ownerId: true, slug: true },
    })

    if (!language || language.ownerId !== userId) {
        return { error: "Only the language owner can moderate comments" }
    }

    // updateMany scoped to the owner's language: a comment id from elsewhere matches nothing.
    const { count } = await prisma.comment.updateMany({
        where: { id: commentId, languageId },
        data: { isHidden: true },
    })
    if (count === 0) return { error: "Comment not found" }

    revalidatePath(`/lang/${language.slug}`)

    return { success: true }
}

export async function getComments(languageId: string) {
    // A language can be made private after it collected comments; don't keep serving them.
    if (!(await canReadLanguage(languageId, await getUserId()))) return []

    return prisma.comment.findMany({
        where: {
            languageId,
            parentId: null, // Only top-level comments
            isHidden: false,
        },
        include: {
            user: {
                select: { id: true, name: true, image: true },
            },
            replies: {
                where: { isHidden: false },
                include: {
                    user: {
                        select: { id: true, name: true, image: true },
                    },
                },
                orderBy: { createdAt: "asc" },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
    })
}
