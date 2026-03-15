import { prisma } from "@/lib/prisma"

export type SearchScope = "all" | "languages" | "dictionary" | "grammar"

export interface SearchResult {
    languages: Array<{
        id: string
        name: string
        slug: string
        description: string | null
        flagUrl: string | null
        owner: { name: string | null; image: string | null }
        _count: {
            scriptSymbols: number
            grammarPages: number
            dictionaryEntries: number
        }
    }>
    entries: Array<{
        id: string
        lemma: string
        gloss: string
        ipa: string | null
        language: { id: string; name: string; slug: string; fontFamily: string | null }
    }>
    grammarPages: Array<{
        id: string
        title: string
        slug: string
        language: { id: string; name: string; slug: string; fontFamily: string | null }
    }>
}

export async function search(query: string, scope: SearchScope = "all"): Promise<SearchResult> {
    if (!query || query.length < 2) {
        return { languages: [], entries: [], grammarPages: [] }
    }

    const [languages, entries, grammarPages] = await Promise.all([
        // Search Languages
        (scope === "all" || scope === "languages")
            ? prisma.language.findMany({
                where: {
                    visibility: "PUBLIC",
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { description: { contains: query, mode: "insensitive" } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    flagUrl: true,
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                    _count: {
                        select: {
                            scriptSymbols: true,
                            grammarPages: true,
                            dictionaryEntries: true,
                        },
                    },
                },
                take: scope === "languages" ? 50 : 5,
                orderBy: { createdAt: 'desc' }
            })
            : [],

        // Search Dictionary Entries
        (scope === "all" || scope === "dictionary")
            ? prisma.dictionaryEntry.findMany({
                where: {
                    language: { visibility: "PUBLIC" },
                    OR: [
                        { lemma: { contains: query, mode: "insensitive" } },
                        { gloss: { contains: query, mode: "insensitive" } },
                        { ipa: { contains: query, mode: "insensitive" } },
                    ],
                },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            fontFamily: true,
                        },
                    },
                },
                take: scope === "dictionary" ? 50 : 10,
            })
            : [],

        // Search Grammar Pages
        (scope === "all" || scope === "grammar")
            ? prisma.grammarPage.findMany({
                where: {
                    language: { visibility: "PUBLIC" },
                    title: { contains: query, mode: "insensitive" },
                },
                include: {
                    language: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            fontFamily: true,
                        },
                    },
                },
                take: scope === "grammar" ? 50 : 10,
            })
            : [],
    ])

    return {
        languages,
        entries,
        grammarPages,
    }
}
