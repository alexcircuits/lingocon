"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Flag, Heart, Sparkles } from "lucide-react"
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
    const scrollerRef = useRef<HTMLDivElement>(null)
    const [isAnimating, setIsAnimating] = useState(false)

    // Trigger animation after hydration - must be called before any early returns
    useEffect(() => {
        if (languages.length < 1) return
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            setIsAnimating(true)
        }, 100)
        return () => clearTimeout(timer)
    }, [languages.length])

    // Need at least 1 language to make a carousel worthwhile
    if (languages.length < 1) {
        return null
    }

    // Create enough duplicates to fill the screen and enable infinite scroll
    // We need at least 6-8 visible items for smooth loop
    const repeatCount = Math.max(4, Math.ceil(12 / languages.length))
    const duplicatedLanguages = Array(repeatCount).fill(languages).flat()


    return (
        <div className="relative w-full overflow-hidden group">
            {/* Gradient fade edges for seamless look */}
            <div className="absolute inset-y-0 left-0 w-24 md:w-40 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 md:w-40 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none" />

            <div
                ref={scrollerRef}
                className={cn(
                    "flex gap-4 w-max",
                    isAnimating && "animate-scroll",
                    "group-hover:[animation-play-state:paused]"
                )}
                style={{
                    "--animation-duration": `${Math.max(30, languages.length * 8)}s`,
                } as React.CSSProperties}
            >
                {duplicatedLanguages.map((lang, idx) => (
                    <Link
                        key={`${lang.id}-${idx}`}
                        href={`/lang/${lang.slug}`}
                        className="relative flex items-center gap-3 px-5 py-3 rounded-full bg-background/60 dark:bg-white/5 border border-border/30 dark:border-white/10 backdrop-blur-md shadow-sm hover:shadow-lg hover:bg-background/90 dark:hover:bg-white/10 hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-300 ease-out group/card shrink-0"
                    >
                        {/* Flag / Icon */}
                        {lang.flagUrl ? (
                            <div className="relative h-7 w-10 overflow-hidden rounded-sm border border-border/20 shadow-sm shrink-0">
                                <Image
                                    src={lang.flagUrl}
                                    alt={lang.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="h-7 w-10 flex items-center justify-center rounded-sm bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 shrink-0">
                                <Sparkles className="h-3.5 w-3.5 text-primary/50" />
                            </div>
                        )}

                        {/* Name */}
                        <span className="font-medium text-sm text-foreground/90 group-hover/card:text-foreground transition-colors whitespace-nowrap">
                            {lang.name}
                        </span>

                        {/* Favorite count - subtle */}
                        {lang._count.favorites > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground/60 group-hover/card:text-muted-foreground transition-colors">
                                <Heart className="h-3 w-3" />
                                <span className="text-xs font-mono">
                                    {lang._count.favorites}
                                </span>
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    )
}
