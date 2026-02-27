"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const createExampleSchema = z.object({
    sentence: z.string().min(1, "Sentence is required").max(500),
    gloss: z.string().max(500).optional(),
    translation: z.string().min(1, "Translation is required").max(500),
    dictionaryEntryId: z.string().min(1),
    languageId: z.string().min(1),
})

const updateExampleSchema = createExampleSchema.extend({
    id: z.string().min(1),
})

export async function createExampleSentence(input: z.infer<typeof createExampleSchema>) {
    const userId = await getUserId()
    if (!userId) return { error: "Unauthorized" }

    try {
        const validated = createExampleSchema.parse(input)

        const canEdit = await canEditLanguage(validated.languageId, userId)
        if (!canEdit) return { error: "You don't have permission to edit this language" }

        // Get current max order
        const maxOrder = await prisma.exampleSentence.findFirst({
            where: { dictionaryEntryId: validated.dictionaryEntryId },
            orderBy: { order: "desc" },
            select: { order: true },
        })

        const example = await prisma.exampleSentence.create({
            data: {
                sentence: validated.sentence,
                gloss: validated.gloss || null,
                translation: validated.translation,
                dictionaryEntryId: validated.dictionaryEntryId,
                order: (maxOrder?.order ?? -1) + 1,
            },
        })

        // Get language slug for revalidation
        const entry = await prisma.dictionaryEntry.findUnique({
            where: { id: validated.dictionaryEntryId },
            include: { language: { select: { slug: true } } },
        })

        if (entry) {
            revalidatePath(`/studio/lang/${entry.language.slug}/dictionary`)
            revalidatePath(`/lang/${entry.language.slug}/dictionary`)
        }

        return { success: true, data: example }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0]?.message || "Validation failed" }
        }
        return { error: "Failed to create example sentence" }
    }
}

export async function updateExampleSentence(input: z.infer<typeof updateExampleSchema>) {
    const userId = await getUserId()
    if (!userId) return { error: "Unauthorized" }

    try {
        const validated = updateExampleSchema.parse(input)

        const canEdit = await canEditLanguage(validated.languageId, userId)
        if (!canEdit) return { error: "You don't have permission to edit this language" }

        const example = await prisma.exampleSentence.update({
            where: { id: validated.id },
            data: {
                sentence: validated.sentence,
                gloss: validated.gloss || null,
                translation: validated.translation,
            },
        })

        const entry = await prisma.dictionaryEntry.findUnique({
            where: { id: validated.dictionaryEntryId },
            include: { language: { select: { slug: true } } },
        })

        if (entry) {
            revalidatePath(`/studio/lang/${entry.language.slug}/dictionary`)
            revalidatePath(`/lang/${entry.language.slug}/dictionary`)
        }

        return { success: true, data: example }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0]?.message || "Validation failed" }
        }
        return { error: "Failed to update example sentence" }
    }
}

export async function deleteExampleSentence(id: string, languageId: string) {
    const userId = await getUserId()
    if (!userId) return { error: "Unauthorized" }

    const canEdit = await canEditLanguage(languageId, userId)
    if (!canEdit) return { error: "You don't have permission to edit this language" }

    try {
        const example = await prisma.exampleSentence.delete({
            where: { id },
            include: {
                entry: {
                    include: { language: { select: { slug: true } } },
                },
            },
        })

        revalidatePath(`/studio/lang/${example.entry.language.slug}/dictionary`)
        revalidatePath(`/lang/${example.entry.language.slug}/dictionary`)

        return { success: true }
    } catch {
        return { error: "Failed to delete example sentence" }
    }
}

export async function getExampleSentences(dictionaryEntryId: string) {
    return prisma.exampleSentence.findMany({
        where: { dictionaryEntryId },
        orderBy: { order: "asc" },
    })
}
