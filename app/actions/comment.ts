"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createActivity } from "@/lib/utils/activity"

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
        if (validated.parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: validated.parentId },
                select: { languageId: true },
            })
            if (!parent || parent.languageId !== validated.languageId) {
                return { error: "Invalid parent comment" }
            }
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

    await prisma.comment.update({
        where: { id: commentId },
        data: { isHidden: true },
    })

    revalidatePath(`/lang/${language.slug}`)

    return { success: true }
}

export async function getComments(languageId: string) {
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
    })
}
