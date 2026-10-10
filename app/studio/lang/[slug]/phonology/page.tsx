import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { parseLanguageMetadata } from "@/lib/validations/language"
import { PhonologyView } from "./phonology-view"
import { summarizePhonemeFrequency } from "./phoneme-frequency"
import { PhonemeFrequencySummaryCard } from "./phoneme-frequency-summary"

/**
 * Identical transcriptions are aggregated in PostgreSQL (index on languageId) and summarized here;
 * only the bounded top-phoneme summary is rendered. The page used to load every non-null IPA string
 * and serialize the whole language — dictionary entries included — into the client view.
 */
async function getPhonemeFrequency(languageId: string, knownPhonemes: string[]) {
    const groups = await prisma.dictionaryEntry.groupBy({
        by: ["ipa"],
        where: { languageId, AND: [{ ipa: { not: null } }, { ipa: { not: "" } }] },
        _count: { _all: true },
    })
    return summarizePhonemeFrequency(
        groups.map((group) => ({ ipa: group.ipa, count: group._count._all })),
        knownPhonemes
    )
}

export default async function PhonologyPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const userId = await getUserId()
    if (!userId && process.env.DEV_MODE !== "true") {
        redirect("/login")
    }

    const { slug } = await params
    const language = await prisma.language.findUnique({
        where: { slug },
        select: {
            id: true,
            metadata: true,
            scriptSymbols: {
                select: { ipa: true },
                orderBy: { order: "asc" },
            },
        },
    })
    if (!language) {
        notFound()
    }
    // Authorize before reading the project's dictionary.
    if (process.env.DEV_MODE !== "true" && userId && !(await canViewLanguage(language.id, userId))) {
        notFound()
    }

    const symbolIpas = language.scriptSymbols
        .map((symbol) => symbol.ipa)
        .filter((ipa): ipa is string => !!ipa)
    const [frequency, t] = await Promise.all([
        getPhonemeFrequency(language.id, symbolIpas),
        getTranslations("studio.phonology"),
    ])
    // Parsed once, here (legacy invalid fields are dropped, never thrown); the client editor
    // receives only the keys it owns and writes.
    const { syllableStructure, allophonyRules, phonologyOverride } = parseLanguageMetadata(language.metadata)

    return (
        <div className="space-y-8">
            <div className="pb-6 border-b border-border/40">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{t("pageTitle")}</h1>
                <p className="text-muted-foreground">
                    {t("pageDescription")}
                </p>
            </div>

            <PhonologyView
                languageId={language.id}
                metadata={{ syllableStructure, allophonyRules, phonologyOverride }}
                symbolIpas={symbolIpas}
            />

            <PhonemeFrequencySummaryCard summary={frequency} />
        </div>
    )
}
