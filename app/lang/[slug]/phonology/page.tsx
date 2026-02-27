import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PublicPhonologyView } from "./public-phonology-view"

async function getLanguageData(slug: string) {
    const language = await prisma.language.findUnique({
        where: { slug },
        include: {
            scriptSymbols: {
                orderBy: { order: "asc" },
            },
        },
    })

    if (!language || language.visibility === "PRIVATE") {
        return null
    }

    return language
}

export default async function PublicPhonologyPage({
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
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Phonology</h2>
                <p className="mt-2 text-muted-foreground">
                    Sound inventory and phonological rules
                </p>
            </div>

            <PublicPhonologyView
                language={language}
                symbols={language.scriptSymbols}
            />
        </div>
    )
}
