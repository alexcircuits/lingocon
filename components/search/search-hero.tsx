"use client"

import { Input } from "@/components/ui/input"
import { Search, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface SearchHeroProps {
    value: string
    onChange: (value: string) => void
}

export function SearchHero({ value, onChange }: SearchHeroProps) {
    const router = useRouter()

    return (
        <div className="relative mb-8 flex w-full flex-col items-center justify-center text-center">
            <div className="absolute left-0 top-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
            </div>

            <div className="mb-8 mt-12 space-y-2 md:mt-0">
                <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl lg:text-6xl">
                    Discover Languages
                </h1>
                <p className="max-w-[600px] text-lg text-muted-foreground md:text-xl">
                    Search across thousands of constructed languages, dictionary entries, and community grammars.
                </p>
            </div>

            <div className="relative w-full max-w-2xl transform transition-all duration-200 focus-within:scale-[1.02]">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <Search className="h-6 w-6" />
                </div>
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="What are you looking for?"
                    className="h-16 w-full rounded-2xl border-2 border-primary/10 bg-background/50 pl-14 text-lg shadow-lg backdrop-blur-xl transition-all placeholder:text-muted-foreground/40 hover:bg-background/80 focus:border-primary/20 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:bg-muted/10"
                />
                {value && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <kbd className="hidden rounded border border-border/50 bg-muted/20 px-2 py-1 font-mono text-xs text-muted-foreground md:inline-flex">
                            ESC
                        </kbd>
                    </div>
                )}
            </div>
        </div>
    )
}
