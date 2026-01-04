"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { SearchScope, SearchResult } from "@/lib/services/search"
import { SearchHero } from "@/components/search/search-hero"
import { SearchTabs } from "@/components/search/search-tabs"
import { ResultCard } from "@/components/search/result-card"
import { SearchEmpty } from "@/components/search/search-empty"
import { Loader2 } from "lucide-react"

export function SearchResults() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialQuery = searchParams.get("q") || ""
    const [query, setQuery] = useState(initialQuery)
    const [activeTab, setActiveTab] = useState<SearchScope>("all")
    const [results, setResults] = useState<SearchResult | null>(null)
    const [loading, setLoading] = useState(false)

    const debouncedQuery = useDebounce(query, 300)

    // Sync URL with query
    useEffect(() => {
        const params = new URLSearchParams(searchParams)
        if (debouncedQuery) {
            params.set("q", debouncedQuery)
        } else {
            params.delete("q")
        }
        router.replace(`/search?${params.toString()}`, { scroll: false })
    }, [debouncedQuery, router])

    // Fetch results
    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setResults(null)
            return
        }

        setLoading(true)
        fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&scope=${activeTab}`)
            .then((res) => res.json())
            .then((data) => {
                setResults(data)
                setLoading(false)
            })
            .catch((err) => {
                console.error(err)
                setLoading(false)
            })
    }, [debouncedQuery, activeTab])

    const counts = {
        all: results ? results.languages.length + results.entries.length + results.grammarPages.length : 0,
        languages: results?.languages.length || 0,
        dictionary: results?.entries.length || 0,
        grammar: results?.grammarPages.length || 0,
    }

    const showLanguages = (activeTab === "all" || activeTab === "languages") && results?.languages.length
    const showEntries = (activeTab === "all" || activeTab === "dictionary") && results?.entries.length
    const showGrammar = (activeTab === "all" || activeTab === "grammar") && results?.grammarPages.length

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6">
            <SearchHero value={query} onChange={setQuery} />

            {debouncedQuery.length >= 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SearchTabs
                        currentTab={activeTab}
                        onTabChange={setActiveTab}
                        counts={counts}
                    />

                    {loading ? (
                        <div className="flex justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                        </div>
                    ) : !results || counts.all === 0 ? (
                        <SearchEmpty />
                    ) : (
                        <div className="space-y-12">
                            {showLanguages ? (
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {results.languages.map((lang) => (
                                        <ResultCard
                                            key={lang.id}
                                            result={{ ...lang, type: "language" }}
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {(showEntries || showGrammar) && (
                                <div className="grid gap-6 md:grid-cols-2">
                                    {showEntries ? (
                                        <div className="space-y-4">
                                            {activeTab === "all" && <h3 className="font-semibold text-muted-foreground">Dictionary Entries</h3>}
                                            {results?.entries.map((entry) => (
                                                <ResultCard
                                                    key={entry.id}
                                                    result={{ ...entry, type: "entry" }}
                                                />
                                            ))}
                                        </div>
                                    ) : null}

                                    {showGrammar ? (
                                        <div className="space-y-4">
                                            {activeTab === "all" && <h3 className="font-semibold text-muted-foreground">Grammar Pages</h3>}
                                            {results?.grammarPages.map((page) => (
                                                <ResultCard
                                                    key={page.id}
                                                    result={{ ...page, type: "grammar" }}
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
