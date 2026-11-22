import { ArrowUpRight, Heart, UserRound } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { OPEN_COLLECTIVE_URL } from "@/lib/open-collective/constants"
import type { Backer } from "@/lib/open-collective/parse-backers"
import { cn } from "@/lib/utils"

interface TopBackersProps {
    /** Largest contributor first; see `getTopBackers`. */
    backers: readonly Backer[]
    /** ISO 4217 code of the collective's currency. */
    currency: string
}

const EXTERNAL_LINK = { target: "_blank", rel: "noopener noreferrer" } as const

function BackerAvatar({ backer }: { backer: Backer }) {
    // Open Collective's own convention: people are round, organizations are squared.
    const shape = backer.kind === "organization" ? "rounded-xl" : "rounded-full"

    if (backer.imageUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element -- small remote avatar from Open Collective's image host
            <img
                src={backer.imageUrl}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className={cn("h-11 w-11 shrink-0 bg-muted object-cover", shape)}
            />
        )
    }

    const initial = backer.name ? Array.from(backer.name)[0]?.toUpperCase() : undefined
    return (
        <span
            aria-hidden="true"
            className={cn("flex h-11 w-11 shrink-0 items-center justify-center bg-primary/10 font-medium text-primary", shape)}
        >
            {initial ?? <UserRound className="h-5 w-5" />}
        </span>
    )
}

function BackersEmptyState() {
    const t = useTranslations("donate")

    return (
        <section
            aria-labelledby="top-backers-heading"
            className="mx-auto mt-10 flex max-w-3xl flex-col items-center rounded-3xl border border-dashed border-border/70 bg-secondary/10 p-8 backdrop-blur-md"
        >
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                <Heart className="h-5 w-5" />
            </span>
            <h2 id="top-backers-heading" className="mb-2 text-xl font-medium">
                {t("backersEmptyTitle")}
            </h2>
            <p className="mb-6 max-w-md text-sm text-muted-foreground">{t("backersEmptyDesc")}</p>
            <Button asChild variant="outline" className="rounded-full px-6">
                <a href={OPEN_COLLECTIVE_URL} {...EXTERNAL_LINK}>
                    {t("backersEmptyCta")}
                </a>
            </Button>
        </section>
    )
}

/** LingoCon's largest financial contributors on Open Collective. */
export function TopBackers({ backers, currency }: TopBackersProps) {
    const t = useTranslations("donate")
    const format = useFormatter()

    if (backers.length === 0) return <BackersEmptyState />

    const formatTotal = (cents: number) => {
        const fractionDigits = cents % 100 === 0 ? 0 : 2
        return format.number(cents / 100, {
            style: "currency",
            currency,
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        })
    }

    return (
        <section aria-labelledby="top-backers-heading" className="mx-auto mt-16 max-w-3xl md:mt-20">
            <h2 id="top-backers-heading" className="mb-4 text-2xl font-medium md:text-3xl">
                {t("backersHeading")}
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-muted-foreground">{t("backersDesc")}</p>

            {/* Explicit role: Safari/VoiceOver drops list semantics when list-style is none. */}
            <ol role="list" className="flex flex-wrap justify-center gap-3 text-left">
                {backers.map((backer, index) => (
                    <li
                        key={backer.profileUrl ?? `anonymous-${index}`}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-secondary/20 p-4 backdrop-blur-md transition-all duration-300 hover:bg-secondary/30 sm:w-[calc(50%-0.375rem)]"
                    >
                        <BackerAvatar backer={backer} />
                        <div className="min-w-0 flex-1">
                            {backer.name && backer.profileUrl ? (
                                <a
                                    href={backer.profileUrl}
                                    title={backer.name}
                                    {...EXTERNAL_LINK}
                                    className="block truncate rounded-sm font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {backer.name}
                                </a>
                            ) : (
                                <span className="block truncate font-medium text-muted-foreground">
                                    {t("backersAnonymous")}
                                </span>
                            )}
                        </div>
                        <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                            {formatTotal(backer.totalCents)}
                        </span>
                    </li>
                ))}
            </ol>

            <a
                href={OPEN_COLLECTIVE_URL}
                {...EXTERNAL_LINK}
                className="group mt-6 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {t("backersSeeAll")}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
        </section>
    )
}
