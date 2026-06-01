"use client"

import { cn } from "@/lib/utils"
import { Marquee } from "@/components/ui/marquee"

interface Quote {
    name: string
    handle: string
    body: string
}

const QUOTES: Quote[] = [
    {
        name: "Mara V.",
        handle: "@worldsmith",
        body: "Finally ditched my tangle of spreadsheets. The derivation trees alone are worth it.",
    },
    {
        name: "Den R.",
        handle: "@runeforge",
        body: "Built a full script + lexicon for my TTRPG in a weekend. Players are obsessed.",
    },
    {
        name: "Aiko T.",
        handle: "@glossolalia",
        body: "Interlinear glossing that stays linked to the dictionary is a game changer.",
    },
    {
        name: "Sol P.",
        handle: "@conlangdaily",
        body: "Paradigm tables generate inflections automatically. My morphology has never been cleaner.",
    },
    {
        name: "Iris K.",
        handle: "@languagelab",
        body: "Open source, free, and genuinely well designed. Rare combination.",
    },
    {
        name: "Tomas B.",
        handle: "@mythwright",
        body: "Exported the whole grammar to PDF for my players. Looked like a published reference.",
    },
]

function QuoteCard({ name, handle, body }: Quote) {
    return (
        <figure
            className={cn(
                "relative w-72 shrink-0 cursor-default overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm",
                "transition-colors hover:border-primary/30",
            )}
        >
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(var(--aurora-magenta))] text-sm font-bold text-primary-foreground">
                    {name.charAt(0)}
                </div>
                <div className="flex flex-col">
                    <figcaption className="text-sm font-semibold text-foreground">
                        {name}
                    </figcaption>
                    <span className="text-xs text-muted-foreground">{handle}</span>
                </div>
            </div>
            <blockquote className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                “{body}”
            </blockquote>
        </figure>
    )
}

export function TestimonialsMarquee() {
    const half = Math.ceil(QUOTES.length / 2)
    const first = QUOTES.slice(0, half)
    const second = QUOTES.slice(half)
    return (
        <div className="relative flex flex-col gap-4 overflow-hidden">
            <Marquee pauseOnHover className="[--duration:38s]">
                {first.map((q) => (
                    <QuoteCard key={q.handle} {...q} />
                ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="[--duration:38s]">
                {second.map((q) => (
                    <QuoteCard key={q.handle} {...q} />
                ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-[hsl(var(--background))] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-[hsl(var(--background))] to-transparent" />
        </div>
    )
}
