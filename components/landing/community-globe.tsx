"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { NumberTicker } from "@/components/ui/number-ticker"

const Globe = dynamic(
    () => import("@/components/ui/globe").then((m) => m.Globe),
    { ssr: false },
)

export function CommunityGlobe({
    languageCount,
    wordCount,
    userCount,
}: {
    languageCount: number
    wordCount: number
    userCount: number
}) {
    const t = useTranslations("landing.globe")
    const tStats = useTranslations("landing.socialProof")
    const stats = [
        { key: "languages", label: tStats("languages"), value: languageCount },
        { key: "words", label: tStats("words"), value: wordCount },
        { key: "conlangers", label: tStats("conlangers"), value: userCount },
    ]
    return (
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] aurora-glass px-6 pt-14 pb-0 text-center">
            <h2 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
                {t.rich("title", {
                    accent: (chunks) => (
                        <span className="aurora-gradient-text">{chunks}</span>
                    ),
                })}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                {t("subtitle")}
            </p>

            <div className="mx-auto mt-8 flex max-w-2xl justify-center gap-10 sm:gap-16">
                {stats.map((s) => (
                    <div key={s.key}>
                        <div className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                            <NumberTicker value={s.value} className="text-foreground" />
                            {s.value >= 25 ? "+" : ""}
                        </div>
                        <div className="mt-1 text-sm font-medium text-muted-foreground">
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative mt-6 h-[320px] w-full md:h-[420px]">
                <Globe className="!max-w-[820px] [mask-image:radial-gradient(circle_at_50%_0%,black_55%,transparent_78%)]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
            </div>
        </div>
    )
}
