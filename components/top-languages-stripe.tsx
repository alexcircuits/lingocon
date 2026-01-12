"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Flag, Trophy, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopLanguage {
    id: string
    name: string
    slug: string
    flagUrl: string | null
    _count: {
        favorites: number
    }
}

interface TopLanguagesStripeProps {
    languages: TopLanguage[]
}

export function TopLanguagesStripe({ languages }: TopLanguagesStripeProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollerRef = useRef<HTMLDivElement>(null)
    const [start, setStart] = useState(false)

    useEffect(() => {
        addAnimation()
    }, [])

    function addAnimation() {
        if (containerRef.current && scrollerRef.current) {
            const scrollerContent = Array.from(scrollerRef.current.children)

            // Duplicate items to ensure smooth infinite scroll
            scrollerContent.forEach((item) => {
                const duplicatedItem = item.cloneNode(true)
                if (scrollerRef.current) {
                    scrollerRef.current.appendChild(duplicatedItem)
                }
            })

            setStart(true)
        }
    }

    return (
        <div
            ref={containerRef}
            className="group relative w-full overflow-hidden bg-primary/5 py-6 select-none border-y border-primary/10 backdrop-blur-sm"
        >
            {/* Fade Edges */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div
                ref={scrollerRef}
                className={cn(
                    "flex min-w-full shrink-0 gap-4 w-max flex-nowrap",
                    start && "animate-scroll",
                    "group-hover:[animation-play-state:paused]" // Pause on hover
                )}
                style={{
                    "--animation-duration": "60s",
                    "--animation-direction": "forwards",
                } as React.CSSProperties}
            >
                {languages.map((lang, idx) => (
                    <Link
                        key={`${lang.id}-${idx}`}
                        href={`/lang/${lang.slug}`}
                        className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl bg-background/40 border border-white/20 dark:border-white/10 shadow-sm hover:shadow-md hover:bg-background/80 hover:-translate-y-0.5 transition-all duration-300 group/card shrink-0  min-w-[180px]"
                    >
                        {/* Rank Badge */}
                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary opacity-0 group-hover/card:opacity-100 transition-opacity">
                            {idx + 1}
                        </div>

                        {/* Flag / Icon */}
                        {lang.flagUrl ? (
                            <div className="relative h-8 w-12 overflow-hidden rounded-md border border-border/40 shadow-sm shrink-0">
                                <Image
                                    src={lang.flagUrl}
                                    alt={lang.name}
                                    fill
                                    className="object-cover transition-transform group-hover/card:scale-110"
                                    unoptimized={lang.flagUrl.startsWith("/uploads/")}
                                />
                            </div>
                        ) : (
                            <div className="h-8 w-12 flex items-center justify-center rounded-md bg-secondary border border-border/40 shrink-0">
                                <Flag className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex flex-col min-w-0">
                            <span className="font-serif font-medium text-sm text-foreground truncate group-hover/card:text-primary transition-colors">
                                {lang.name}
                            </span>
                            <div className="flex items-center gap-1.5 opacity-60">
                                <Trophy className="h-3 w-3 text-amber-500" />
                                <span className="text-[10px] font-mono text-muted-foreground">
                                    {lang._count.favorites}
                                </span>
                            </div>
                        </div>

                        {/* Highlight effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/card:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
                    </Link>
                ))}
            </div>
        </div>
    )
}
