"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { BookCard, type BookCardLanguage } from "@/components/landing/book-card"

type View = "grid" | "list"

export function BrowseResults({ languages }: { languages: BookCardLanguage[] }) {
    const [view, setView] = useState<View>("grid")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        try {
            const stored = localStorage.getItem("browseView")
            if (stored === "list" || stored === "grid") setView(stored)
        } catch {
            /* ignore */
        }
    }, [])

    const choose = (v: View) => {
        setView(v)
        try {
            localStorage.setItem("browseView", v)
        } catch {
            /* ignore */
        }
    }

    return (
        <div>
            <div className="mb-6 flex justify-end">
                <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1">
                    <button
                        type="button"
                        onClick={() => choose("grid")}
                        aria-label="Grid view"
                        aria-pressed={mounted && view === "grid"}
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                            mounted && view === "grid"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => choose("list")}
                        aria-label="List view"
                        aria-pressed={mounted && view === "list"}
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                            mounted && view === "list"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <List className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {view === "list" ? (
                <div className="flex flex-col gap-3">
                    {languages.map((language) => (
                        <BookCard key={language.id} language={language} view="list" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {languages.map((language) => (
                        <BookCard key={language.id} language={language} view="grid" />
                    ))}
                </div>
            )}
        </div>
    )
}
