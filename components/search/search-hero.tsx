"use client"

import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { useRef, useEffect } from "react"
import Link from "next/link"

interface SearchHeroProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    compact?: boolean
}

export function SearchHero({ value, onChange, onSubmit, compact }: SearchHeroProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!compact && inputRef.current) {
            inputRef.current.focus()
        }
    }, [compact])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            onSubmit()
        }
        if (e.key === "Escape") {
            onChange("")
            inputRef.current?.blur()
        }
    }

    if (compact) {
        return (
            <div className="flex w-full items-center gap-4 pt-5 pb-0 px-4 md:px-0">
                <Link
                    href="/search"
                    onClick={(e) => { e.preventDefault(); onChange("") }}
                    className="shrink-0 hidden md:block"
                >
                    <span className="text-2xl font-extrabold tracking-tight aurora-gradient-text">
                        LingoCon
                    </span>
                </Link>
                
                <div className="relative w-full max-w-[690px]">
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                        <Search className="h-[18px] w-[18px]" />
                    </div>
                    <Input
                        ref={inputRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search LingoCon..."
                        className="h-11 w-full rounded-full border border-border/60 bg-background pl-11 pr-10 text-base shadow-sm transition-all hover:shadow-md focus:shadow-md focus:border-border focus:ring-0 dark:bg-muted/10"
                    />
                    {value && (
                        <button
                            onClick={() => { onChange(""); inputRef.current?.focus() }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col items-center justify-center text-center py-[120px] md:py-[140px]">
            <div className="mb-10">
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight select-none aurora-gradient-text">
                    LingoCon
                </h1>
            </div>

            <div className="relative w-full max-w-[584px] px-4 group">
                <div className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <Search className="h-5 w-5" />
                </div>
                <Input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search constructed languages..."
                    className="h-12 w-full rounded-full border border-border/60 bg-background pl-12 pr-12 text-base shadow-sm transition-all hover:shadow-md focus:shadow-md focus:border-border focus:ring-0 dark:bg-muted/10"
                />
                {value && (
                    <button
                        onClick={() => { onChange(""); inputRef.current?.focus() }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-3">
                <button
                    onClick={onSubmit}
                    className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 border border-border/30 rounded-md text-foreground transition-colors"
                >
                    LingoCon Search
                </button>
                <Link
                    href="/browse"
                    className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 border border-border/30 rounded-md text-foreground transition-colors"
                >
                    Browse Languages
                </Link>
            </div>
        </div>
    )
}
