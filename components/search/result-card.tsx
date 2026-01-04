"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, FileText, Globe, Hash, Languages } from "lucide-react"

interface BaseResult {
    id: string
}

interface LanguageResult extends BaseResult {
    type: "language"
    name: string
    slug: string
    description: string | null
    flagUrl: string | null
    owner: { name: string | null; image: string | null }
    _count: {
        scriptSymbols: number
        grammarPages: number
        dictionaryEntries: number
    }
}

interface DictionaryResult extends BaseResult {
    type: "entry"
    lemma: string
    gloss: string
    ipa: string | null
    language: { id: string; name: string; slug: string }
}

interface GrammarResult extends BaseResult {
    type: "grammar"
    title: string
    slug: string
    language: { id: string; name: string; slug: string }
}

type SearchResultItem = LanguageResult | DictionaryResult | GrammarResult

interface ResultCardProps {
    result: SearchResultItem
}

export function ResultCard({ result }: ResultCardProps) {
    if (result.type === "language") {
        return (
            <Link href={`/lang/${result.slug}`} className="group block h-full">
                <Card className="h-full overflow-hidden border-muted/40 bg-card/50 transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg dark:bg-muted/10">
                    <CardContent className="p-0">
                        {/* Header/Banner Area */}
                        <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
                            <div className="absolute right-4 top-4 opacity-10 transition-transform group-hover:scale-110 group-hover:opacity-20">
                                <Globe className="h-24 w-24" />
                            </div>
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background shadow-sm ring-1 ring-border/50">
                                    {result.flagUrl ? (
                                        <img
                                            src={result.flagUrl}
                                            alt={result.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Languages className="h-6 w-6 text-primary/60" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold tracking-tight text-foreground">{result.name}</h3>
                                    <p className="text-xs text-muted-foreground">by {result.owner.name || "Unknown"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-4">
                            <p className="line-clamp-2 text-sm text-muted-foreground/80 mb-4 h-10">
                                {result.description || "No description provided."}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>{result._count.dictionaryEntries}</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    <span>{result._count.grammarPages}</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                                    <Hash className="h-3.5 w-3.5" />
                                    <span>{result._count.scriptSymbols}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </Link>
        )
    }

    if (result.type === "entry") {
        return (
            <Link href={`/lang/${result.language.slug}/dictionary`} className="group block">
                <Card className="border-muted/40 bg-card/50 transition-all hover:bg-muted/20 hover:border-blue-500/20 dark:bg-muted/5">
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="font-bold text-foreground">{result.lemma}</h3>
                                    {result.ipa && (
                                        <span className="font-mono text-xs text-muted-foreground">/{result.ipa}/</span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-1">{result.gloss}</p>
                            </div>
                        </div>
                        <Badge variant="secondary" className="bg-background/50 text-xs font-normal text-muted-foreground">
                            {result.language.name}
                        </Badge>
                    </CardContent>
                </Card>
            </Link>
        )
    }

    if (result.type === "grammar") {
        return (
            <Link href={`/lang/${result.language.slug}/grammar/${result.slug}`} className="group block">
                <Card className="border-muted/40 bg-card/50 transition-all hover:bg-muted/20 hover:border-amber-500/20 dark:bg-muted/5">
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">{result.title}</h3>
                                <p className="text-xs text-muted-foreground">Grammar Guide</p>
                            </div>
                        </div>
                        <Badge variant="secondary" className="bg-background/50 text-xs font-normal text-muted-foreground">
                            {result.language.name}
                        </Badge>
                    </CardContent>
                </Card>
            </Link>
        )
    }

    return null
}
