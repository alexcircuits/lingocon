"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { createActivity } from "@/lib/utils/activity"
import { z } from "zod"

// Schema for generic import format (e.g. third-party tools)
const genericSchema = z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    lexicon: z.array(z.object({
        word: z.string(),
        definition: z.string(),
        ipa: z.string().optional(),
        pos: z.string().optional(),
        etymology: z.string().optional(),
    }).passthrough())
}).passthrough()

// Schema for LingoCon's own export format
const lingoconSchema = z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    dictionaryEntries: z.array(z.object({
        lemma: z.string(),
        gloss: z.string(),
        ipa: z.string().nullable().optional(),
        partOfSpeech: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        etymology: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
    }).passthrough()).optional().default([]),
    scriptSymbols: z.array(z.object({
        symbol: z.string(),
        ipa: z.string().nullable().optional(),
        latin: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        order: z.number().optional(),
    }).passthrough()).optional().default([]),
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

        // Try LingoCon native format first, then fall back to generic
        const lingoconResult = lingoconSchema.safeParse(rawData)
        const genericResult = genericSchema.safeParse(rawData)

        if (!lingoconResult.success && !genericResult.success) {
            // Show the more relevant error
            const err = rawData?.dictionaryEntries ? lingoconResult.error : genericResult.error
            return {
                error: "Invalid JSON format: " + err.issues.map(i => i.message).join(", ")
            }
        }

        const isLingocon = lingoconResult.success
        const validData = isLingocon ? lingoconResult.data : genericResult.data!

        // Generate a unique slug
        let slug = validData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        let suffix = 1
        const originalSlug = slug
        
        // Create the language with retry loop for slug collisions
        let language = null
        while (!language) {
            try {
                language = await prisma.language.create({
                    data: {
                        name: validData.name,
                        slug: slug,
                        description: validData.description || `Imported from ${validData.name} JSON`,
                        ownerId: userId,
                        visibility: "PRIVATE",
                    },
                })
            } catch (error: unknown) {
                const prismaError = error as { code?: string }
                if (prismaError.code === 'P2002') {
                    slug = `${originalSlug}-${suffix}`
                    suffix++
                } else {
                    throw error
                }
            }
        }

        // Normalize entries from either format
        let entriesToCreate: {
            languageId: string
            lemma: string
            gloss: string
            ipa: string | null
            partOfSpeech: string | null
            etymology: string | null
            notes: string | null
        }[]

        if (isLingocon) {
            const data = lingoconResult.data
            entriesToCreate = data.dictionaryEntries
                .filter(entry => entry.lemma && entry.gloss)
                .map(entry => ({
                    languageId: language.id,
                    lemma: entry.lemma,
                    gloss: entry.gloss,
                    ipa: entry.ipa ?? null,
                    partOfSpeech: entry.partOfSpeech ?? null,
                    etymology: entry.etymology ?? null,
                    notes: entry.notes ?? null,
                }))
        } else {
            const data = genericResult.data!
            entriesToCreate = data.lexicon
                .filter(entry => entry.word && entry.definition)
                .map(entry => ({
                    languageId: language.id,
                    lemma: entry.word,
                    gloss: entry.definition,
                    ipa: entry.ipa ?? null,
                    partOfSpeech: entry.pos ?? null,
                    etymology: entry.etymology ?? null,
                    notes: null,
                }))
        }

        // Use createMany for performance
        if (entriesToCreate.length > 0) {
            await prisma.dictionaryEntry.createMany({
                data: entriesToCreate,
            })
        }

        // Import script symbols from LingoCon format
        if (isLingocon && lingoconResult.data.scriptSymbols.length > 0) {
            await prisma.scriptSymbol.createMany({
                data: lingoconResult.data.scriptSymbols.map((s, i) => ({
                    languageId: language.id,
                    symbol: s.symbol,
                    ipa: s.ipa ?? null,
                    latin: s.latin ?? null,
                    name: s.name ?? null,
                    order: s.order ?? i,
                })),
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
