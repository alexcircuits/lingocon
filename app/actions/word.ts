"use server"

import { prisma } from "@/lib/prisma"

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

/**
 * Get a deterministic "word of the day" based on the current date.
 * Uses a seeded random selection to ensure all visitors see the same word each day.
 */
export async function getWordOfTheDay(): Promise<WordOfTheDay | null> {
    // Count dictionary entries from public languages
    const count = await prisma.dictionaryEntry.count({
        where: {
            language: {
                visibility: "PUBLIC",
            },
        },
    })

    if (count === 0) {
        return null
    }

    // Create a deterministic seed based on today's date
    const today = new Date()
    const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
    const seed = hashCode(dateString)

    // Pick a deterministic index and fetch just that one entry
    const index = Math.abs(seed) % count
    const entries = await prisma.dictionaryEntry.findMany({
        where: {
            language: {
                visibility: "PUBLIC",
            },
        },
        select: {
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
                        select: {
                            symbol: true,
                            latin: true,
                        },
                    },
                },
            },
        },
        skip: index,
        take: 1,
    })

    return entries[0] ?? null
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
