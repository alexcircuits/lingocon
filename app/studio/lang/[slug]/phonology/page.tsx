import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PhonologyView } from "./phonology-view"

async function getLanguageData(slug: string) {
    const language = await prisma.language.findUnique({
        where: { slug },
        include: {
            scriptSymbols: {
                orderBy: { order: "asc" },
            },
        },
    })

    if (!language) return null
    return language
}

export default async function PhonologyPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const language = await getLanguageData(slug)

    if (!language) {
        notFound()
    }

    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-border/40">
                <h1 className="text-3xl font-serif tracking-tight mb-1">Phonology</h1>
                <p className="text-muted-foreground">
                    Sound inventory, syllable structure, and phonological rules
                </p>
            </div>

            <PhonologyView
                language={language}
                symbols={language.scriptSymbols}
            />
        </div>
    )
}
