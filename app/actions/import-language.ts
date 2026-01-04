"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { createActivity } from "@/lib/utils/activity"
import { z } from "zod"

// Schema for the imported JSON format
const importSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    lexicon: z.array(z.object({
        word: z.string(),
        definition: z.string(),
        ipa: z.string().optional(),
        pos: z.string().optional(),
        etymology: z.string().optional(),
        // Allow other fields but don't require them
    }).passthrough())
}).passthrough()

export async function importLanguage(jsonContent: string) {
    const userId = await getUserId()

    if (!userId) {
        return {
            error: "Unauthorized",
        }
    }

    try {
        const rawData = JSON.parse(jsonContent)
        const validData = importSchema.parse(rawData)

        // Generate a unique slug
        let slug = validData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        // Ensure slug is unique
        let suffix = 1
        let originalSlug = slug
        while (await prisma.language.findUnique({ where: { slug } })) {
            slug = `${originalSlug}-${suffix}`
            suffix++
        }

        // Create the language
        const language = await prisma.language.create({
            data: {
                name: validData.name,
                slug: slug,
                description: validData.description || `Imported from ${validData.name} JSON`,
                ownerId: userId,
                visibility: "PRIVATE",
            },
        })

        // Create dictionary entries
        // Filter out entries without word or definition to be safe
        const entriesToCreate = validData.lexicon
            .filter(entry => entry.word && entry.definition)
            .map(entry => ({
                languageId: language.id,
                lemma: entry.word,
                gloss: entry.definition,
                ipa: entry.ipa || null,
                partOfSpeech: entry.pos || null,
                etymology: entry.etymology || null,
            }))

        // Use createMany for performance
        if (entriesToCreate.length > 0) {
            await prisma.dictionaryEntry.createMany({
                data: entriesToCreate,
            })
        }

        // Log activity
        await createActivity({
            type: "CREATED",
            entityType: "LANGUAGE",
            entityId: language.id,
            languageId: language.id,
            userId,
            description: `Imported language "${language.name}" with ${entriesToCreate.length} entries`,
            metadata: { source: "json_import", entryCount: entriesToCreate.length },
        })

        return {
            success: true,
            data: language,
            count: entriesToCreate.length
        }

    } catch (error) {
        console.error("Import error:", error)
        if (error instanceof z.ZodError) {
            return {
                error: "Invalid JSON format: " + error.issues.map(i => i.message).join(", ")
            }
        }
        if (error instanceof SyntaxError) {
            return {
                error: "Invalid JSON file"
            }
        }
        return {
            error: "Failed to import language: " + (error instanceof Error ? error.message : "Unknown error")
        }
    }
}
