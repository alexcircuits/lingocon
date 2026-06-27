"use server"

import { prisma } from "@/lib/prisma"
import type { Language } from "@prisma/client"
import { getUserId } from "@/lib/auth-helpers"
import { createActivity } from "@/lib/utils/activity"
import { parseImportPayload } from "@/lib/validations/import-language"

export async function importLanguage(jsonContent: string) {
    const userId = await getUserId()

    if (!userId) {
        return {
            error: "Unauthorized",
        }
    }

    try {
        const rawData = JSON.parse(jsonContent)

        const parsed = parseImportPayload(rawData)
        if ("error" in parsed) {
            return { error: parsed.error }
        }

        const validData = parsed.data

        // Build the dictionary entries / script symbols for whichever format was
        // supplied. Both reference the new language id, so they are produced
        // inside the transaction below, once the language row exists.
        type EntryCreate = {
            languageId: string
            lemma: string
            gloss: string
            ipa: string | null
            partOfSpeech: string | null
            etymology: string | null
            notes: string | null
        }

        const buildEntries = (languageId: string): EntryCreate[] => {
            if (parsed.format === "lingocon") {
                return (parsed.data.dictionaryEntries ?? [])
                    .filter(entry => entry.lemma && entry.gloss)
                    .map(entry => ({
                        languageId,
                        lemma: entry.lemma,
                        gloss: entry.gloss,
                        ipa: entry.ipa ?? null,
                        partOfSpeech: entry.partOfSpeech ?? null,
                        etymology: entry.etymology ?? null,
                        notes: entry.notes ?? null,
                    }))
            }
            return parsed.data.lexicon
                .filter(entry => entry.word && entry.definition)
                .map(entry => ({
                    languageId,
                    lemma: entry.word,
                    gloss: entry.definition,
                    ipa: entry.ipa ?? null,
                    partOfSpeech: entry.pos ?? null,
                    etymology: entry.etymology ?? null,
                    notes: null,
                }))
        }

        const buildScript = (languageId: string) =>
            parsed.format === "lingocon"
                ? (parsed.data.scriptSymbols ?? []).map((s, i) => ({
                      languageId,
                      symbol: s.symbol,
                      ipa: s.ipa ?? null,
                      latin: s.latin ?? null,
                      name: s.name ?? null,
                      order: s.order ?? i,
                  }))
                : []

        // Create the language and all its imported content atomically, so a
        // partial failure can never leave an orphaned language with missing or
        // half-imported data. The slug is unique; on collision (P2002) the whole
        // transaction rolls back and we retry with a numbered suffix.
        let slug = validData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        const originalSlug = slug
        let suffix = 1

        let language: Language | null = null
        let entryCount = 0

        for (let attempt = 0; attempt < 100 && !language; attempt++) {
            try {
                const result = await prisma.$transaction(
                    async (tx) => {
                        const lang = await tx.language.create({
                            data: {
                                name: validData.name,
                                slug,
                                description: validData.description || `Imported from ${validData.name} JSON`,
                                ownerId: userId,
                                visibility: "PRIVATE",
                            },
                        })

                        const entries = buildEntries(lang.id)
                        if (entries.length > 0) {
                            await tx.dictionaryEntry.createMany({ data: entries })
                        }

                        const script = buildScript(lang.id)
                        if (script.length > 0) {
                            await tx.scriptSymbol.createMany({ data: script })
                        }

                        return { lang, entryCount: entries.length }
                    },
                    { timeout: 30000 },
                )
                language = result.lang
                entryCount = result.entryCount
            } catch (error: unknown) {
                const prismaError = error as { code?: string }
                if (prismaError.code === "P2002") {
                    slug = `${originalSlug}-${suffix}`
                    suffix++
                    continue
                }
                throw error
            }
        }

        if (!language) {
            return { error: "Failed to import language: could not generate a unique slug" }
        }

        // Activity logging is best-effort (createActivity swallows its own
        // errors) and must not roll back a successful import, so it runs only
        // after the transaction has committed.
        await createActivity({
            type: "CREATED",
            entityType: "LANGUAGE",
            entityId: language.id,
            languageId: language.id,
            userId,
            description: `Imported language "${language.name}" with ${entryCount} entries`,
            metadata: { source: "json_import", entryCount },
        })

        return {
            success: true,
            data: language,
            count: entryCount,
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
