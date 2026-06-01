"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
    const [searchTime, setSearchTime] = useState<number | null>(null)
    const hasSearched = useRef(false)

    const debouncedQuery = useDebounce(query, 350)

    // Sync URL with query
    useEffect(() => {
        if (debouncedQuery) {
            router.replace(`/search?q=${encodeURIComponent(debouncedQuery)}`, { scroll: false })
        } else if (hasSearched.current) {
            router.replace("/search", { scroll: false })
        }
    }, [debouncedQuery, router])

    // Fetch results
    const fetchResults = useCallback(async (q: string, scope: SearchScope) => {
        if (!q || q.length < 2) {
            setResults(null)
            setSearchTime(null)
            return
        }

        setLoading(true)
        const startTime = performance.now()
        
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope}`)
            const data = await res.json()
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
            setResults(data)
            setSearchTime(Number(elapsed))
            hasSearched.current = true
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchResults(debouncedQuery, activeTab)
    }, [debouncedQuery, activeTab, fetchResults])

    const handleSubmit = () => {
        if (query.length >= 2) {
            fetchResults(query, activeTab)
        }
    }

    const counts = {
        all: results ? results.languages.length + results.entries.length + results.grammarPages.length + results.articles.length + results.texts.length : 0,
        languages: results?.languages.length || 0,
        dictionary: results?.entries.length || 0,
        grammar: results?.grammarPages.length || 0,
        articles: results?.articles.length || 0,
        texts: results?.texts.length || 0,
    }

    const showLanguages = (activeTab === "all" || activeTab === "languages") && results?.languages.length
    const showEntries = (activeTab === "all" || activeTab === "dictionary") && results?.entries.length
    const showGrammar = (activeTab === "all" || activeTab === "grammar") && results?.grammarPages.length
    const showArticles = (activeTab === "all" || activeTab === "articles") && results?.articles.length
    const showTexts = (activeTab === "all" || activeTab === "texts") && results?.texts.length

    const isSearchActive = debouncedQuery.length >= 2

    return (
        <div className="mx-auto w-full max-w-[1078px]">
            <SearchHero
                value={query}
                onChange={setQuery}
                onSubmit={handleSubmit}
                compact={isSearchActive}
            />

            {isSearchActive && (
                <>
                    <SearchTabs
                        currentTab={activeTab}
                        onTabChange={setActiveTab}
                        counts={counts}
                    />

                    {loading ? (
                        <div className="flex justify-center py-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
                        </div>
                    ) : !results || counts.all === 0 ? (
                        <SearchEmpty />
                    ) : (
                        <div className="px-4 md:px-0 md:ml-[140px] pt-4 pb-16">
                            {/* Result stats */}
                            <p className="text-xs text-foreground/50 mb-4">
                                About {counts.all} result{counts.all !== 1 ? "s" : ""}
                                {searchTime !== null && ` (${searchTime} seconds)`}
                            </p>

                            {/* Languages */}
                            {showLanguages && results.languages.map((lang) => (
                                <ResultCard
                                    key={lang.id}
                                    result={{ ...lang, type: "language" }}
                                    query={debouncedQuery}
                                />
                            ))}

                            {/* Dictionary Entries */}
                            {showEntries && results.entries.map((entry) => (
                                <ResultCard
                                    key={entry.id}
                                    result={{ ...entry, type: "entry" }}
                                    query={debouncedQuery}
                                />
                            ))}

                            {/* Grammar Pages */}
                            {showGrammar && results.grammarPages.map((page) => (
                                <ResultCard
                                    key={page.id}
                                    result={{ ...page, type: "grammar" }}
                                    query={debouncedQuery}
                                />
                            ))}

                            {/* Articles */}
                            {showArticles && results.articles.map((article) => (
                                <ResultCard
                                    key={article.id}
                                    result={{ ...article, type: "article" }}
                                    query={debouncedQuery}
                                />
                            ))}

                            {/* Texts */}
                            {showTexts && results.texts.map((text) => (
                                <ResultCard
                                    key={text.id}
                                    result={{ ...text, type: "text" }}
                                    query={debouncedQuery}
                                />
                            ))}

                            {/* Footer */}
                            <div className="mt-8 pt-6 border-t border-border/30 flex flex-col items-center gap-4">
                                <div className="text-3xl font-extrabold tracking-tight select-none aurora-gradient-text">
                                    LingoCon
                                </div>
                                <p className="text-xs text-foreground/40">
                                    Showing {counts[activeTab]} results for &ldquo;{debouncedQuery}&rdquo;
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
