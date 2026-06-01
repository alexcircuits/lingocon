import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PublicPhonologyView } from "./public-phonology-view"
import { PhonemeFrequencyChart } from "@/components/phoneme-frequency-chart"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata } from "@/lib/seo"

export const revalidate = 3600

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const language = await getLanguageSeoData(slug)
    if (!language) return { title: "Phonology Not Found", robots: { index: false, follow: false } }

    return buildLanguageMetadata(language, {
        section: "phonology",
        sectionLabel: "Phonology",
        description: `Explore the phonology of ${language.name} — sound inventory, phonemes, and phonological rules of the ${language.name} constructed language on LingoCon.`,
        keywords: [`${language.name} phonology`, `${language.name} phonemes`, `${language.name} sounds`, `${language.name} IPA`],
    })
}

async function getLanguageData(slug: string) {
    const language = await prisma.language.findUnique({
        where: { slug },
        include: {
            scriptSymbols: {
                orderBy: { order: "asc" },
            },
            dictionaryEntries: {
                select: { ipa: true },
                where: { ipa: { not: null } },
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

            <PhonemeFrequencyChart
                ipaList={language.dictionaryEntries.map(e => e.ipa)}
                knownPhonemes={language.scriptSymbols.map(s => s.ipa).filter((v): v is string => !!v)}
            />
        </div>
    )
}
