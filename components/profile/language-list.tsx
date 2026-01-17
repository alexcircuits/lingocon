"use client"

import { useState } from "react"
import { Search, Sparkles, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LanguageCard } from "@/app/browse/components/language-card"

interface Language {
    id: string
    name: string
    slug: string
    description: string | null
    owner: {
        id: string
        name: string | null
        image: string | null
    }
    _count: {
        scriptSymbols: number
        grammarPages: number
        dictionaryEntries: number
    }
}

interface LanguageListProps {
    languages: any[]
    isOwnProfile: boolean
}

export function LanguageList({ languages, isOwnProfile }: LanguageListProps) {
    const [searchQuery, setSearchQuery] = useState("")

    const filteredLanguages = languages.filter((lang) =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lang.description && lang.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    if (languages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed bg-muted/20">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                    <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">No public languages</h3>
                <p className="mt-2 text-muted-foreground max-w-sm">
                    {isOwnProfile
                        ? "You haven't published any languages yet."
                        : "This user hasn't created any public languages yet."}
                </p>
                {isOwnProfile && (
                    <Link href="/dashboard/new-language" className="mt-6">
                        <Button variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Language
                        </Button>
                    </Link>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search languages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-muted/30 border-muted-foreground/20 focus:bg-background transition-colors"
                />
            </div>

            {/* Grid */}
            {filteredLanguages.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                    {filteredLanguages.map((language) => (
                        <LanguageCard key={language.id} language={language} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    No languages found matching &quot;{searchQuery}&quot;
                </div>
            )}
        </div>
    )
}
