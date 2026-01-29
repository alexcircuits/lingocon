import { prisma } from "@/lib/prisma"
import { canViewLanguage } from "@/lib/auth-helpers"
import { Prisma } from "@prisma/client"

// Define the selection explicitly to ensure type inference works
const exportSelect = {
    id: true,
    name: true,
    description: true,
    slug: true,
    flagUrl: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
    metadata: true,

    // Relations
    scriptSymbols: {
        orderBy: { order: "asc" },
        select: {
            symbol: true,
            ipa: true,
            latin: true,
            name: true,
            order: true,
        },
    },
    grammarPages: {
        orderBy: { order: "asc" },
        select: {
            title: true,
            slug: true,
            content: true,
            order: true,
        },
    },
    dictionaryEntries: {
        orderBy: { lemma: "asc" },
        select: {
            lemma: true,
            gloss: true,
            ipa: true,
            partOfSpeech: true,
            notes: true,
        },
    },
    paradigms: {
        select: {
            id: true,
            name: true,
            slots: true,
            notes: true,
        },
    },

    // Owner (Author)
    owner: {
        select: {
            id: true,
            name: true,
            image: true,
        },
    },
} satisfies Prisma.LanguageSelect

export type ExportData = Prisma.LanguageGetPayload<{ select: typeof exportSelect }>

export async function fetchLanguageForExport(languageId: string, userId: string): Promise<ExportData> {
    // Verify permissions
    const canView = await canViewLanguage(languageId, userId)
    if (!canView) {
        throw new Error("Unauthorized")
    }

    // Fetch complete language data
    const language = await prisma.language.findUnique({
        where: { id: languageId },
        select: exportSelect,
    })

    if (!language) {
        throw new Error("Language not found")
    }

    return language
}
