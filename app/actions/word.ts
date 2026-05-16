"use server"

import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"

export interface WordOfTheDay {
    id: string
    lemma: string
    gloss: string
    ipa: string | null
    partOfSpeech: string | null
    language: {
        id: string
        name: string
        slug: string
        flagUrl: string | null
        fontUrl: string | null
        fontFamily: string | null
        fontScale: number
        scriptSymbols: {
            symbol: string
            latin: string | null
        }[]
    }
}

const entrySelect = {
    id: true,
    lemma: true,
    gloss: true,
    ipa: true,
    partOfSpeech: true,
    language: {
        select: {
            id: true,
            name: true,
            slug: true,
            flagUrl: true,
            fontUrl: true,
            fontFamily: true,
            fontScale: true,
            scriptSymbols: {
                select: { symbol: true, latin: true },
            },
        },
    },
} as const

/**
 * Cached per-day word selector. Fetches all public entry IDs once,
 * picks deterministically by date hash, caches for 24 h.
 * Avoids the O(n) skip-scan anti-pattern.
 */
const getDailyEntryId = unstable_cache(
    async (dateKey: string): Promise<string | null> => {
        const ids = await prisma.dictionaryEntry.findMany({
            where: { language: { visibility: "PUBLIC" } },
            select: { id: true },
            orderBy: { id: "asc" },
        })
        if (ids.length === 0) return null
        const index = Math.abs(hashCode(dateKey)) % ids.length
        return ids[index].id
    },
    ["word-of-the-day-id"],
    { revalidate: 86400, tags: ["word-of-the-day"] }
)

/**
 * Get a deterministic "word of the day" based on the current date.
 * Stable across all visitors for the calendar day.
 */
export async function getWordOfTheDay(): Promise<WordOfTheDay | null> {
    const today = new Date()
    const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

    const entryId = await getDailyEntryId(dateKey)
    if (!entryId) return null

    return prisma.dictionaryEntry.findUnique({
        where: { id: entryId },
        select: entrySelect,
    }) as Promise<WordOfTheDay | null>
}

/**
 * Simple hash function to convert a string to a number
 */
function hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
    }
    return hash
}
