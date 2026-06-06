import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { PhonologyView } from "./phonology-view"
import { PhonemeFrequencyChart } from "@/components/phoneme-frequency-chart"

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
    const t = await getTranslations("studio.phonology")

    if (!language) {
        notFound()
    }

    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-border/40">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{t("pageTitle")}</h1>
                <p className="text-muted-foreground">
                    {t("pageDescription")}
                </p>
            </div>

            <PhonologyView
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
