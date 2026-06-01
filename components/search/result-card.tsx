"use client"

import Link from "next/link"
import { Globe } from "lucide-react"

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
    language: { id: string; name: string; slug: string; fontFamily: string | null }
}

interface GrammarResult extends BaseResult {
    type: "grammar"
    title: string
    slug: string
    language: { id: string; name: string; slug: string; fontFamily: string | null }
}

interface ArticleResult extends BaseResult {
    type: "article"
    title: string
    slug: string
    excerpt: string | null
    language: { id: string; name: string; slug: string }
}

interface TextResult extends BaseResult {
    type: "text"
    title: string
    slug: string
    description: string | null
    language: { id: string; name: string; slug: string }
}

type SearchResultItem = LanguageResult | DictionaryResult | GrammarResult | ArticleResult | TextResult

interface ResultCardProps {
    result: SearchResultItem
    query?: string
}

function highlightMatch(text: string, query?: string): React.ReactNode {
    if (!query || !text) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
        <>
            {text.slice(0, idx)}
            <strong className="font-bold">{text.slice(idx, idx + query.length)}</strong>
            {text.slice(idx + query.length)}
        </>
    )
}

export function ResultCard({ result, query }: ResultCardProps) {
    if (result.type === "language") {
        const url = `/lang/${result.slug}`
        return (
            <div className="group max-w-[600px] mb-6">
                <div className="flex items-center gap-1.5 text-sm mb-0.5">
                    {result.flagUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={result.flagUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-foreground/70">lingocon.com</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">lang</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">{result.slug}</span>
                </div>
                <Link href={url} className="block">
                    <h3 className="text-xl leading-snug text-primary hover:underline cursor-pointer">
                        {highlightMatch(result.name, query)}
                        {result.owner.name && (
                            <span className="text-base text-foreground/50 font-normal"> — by {result.owner.name}</span>
                        )}
                    </h3>
                </Link>
                <p className="text-sm leading-relaxed text-foreground/80 mt-0.5 line-clamp-2">
                    {result.description || `A constructed language with ${result._count.dictionaryEntries} dictionary entries and ${result._count.grammarPages} grammar pages.`}
                </p>
                <div className="flex items-center gap-4 text-xs text-foreground/50 mt-1.5">
                    <span>{result._count.dictionaryEntries} words</span>
                    <span>{result._count.grammarPages} grammar pages</span>
                    <span>{result._count.scriptSymbols} script symbols</span>
                </div>
            </div>
        )
    }

    if (result.type === "entry") {
        const url = `/lang/${result.language.slug}/dictionary?q=${encodeURIComponent(result.lemma)}`
        return (
            <div className="group max-w-[600px] mb-6">
                <div className="flex items-center gap-1.5 text-sm mb-0.5">
                    <span className="text-sm text-foreground/70">lingocon.com</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">{result.language.slug}</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">dictionary</span>
                </div>
                <Link href={url} className="block">
                    <h3 className="text-xl leading-snug text-primary hover:underline cursor-pointer">
                        <span style={result.language.fontFamily ? { fontFamily: result.language.fontFamily } : undefined}>
                            {highlightMatch(result.lemma, query)}
                        </span>
                        {result.ipa && (
                            <span className="text-foreground/50 text-base font-normal ml-2">/{result.ipa}/</span>
                        )}
                    </h3>
                </Link>
                <p className="text-sm leading-relaxed text-foreground/80 mt-0.5 line-clamp-2">
                    <span className="font-medium">{result.language.name}:</span>{" "}
                    {highlightMatch(result.gloss, query)}
                </p>
            </div>
        )
    }

    if (result.type === "grammar") {
        const url = `/lang/${result.language.slug}/grammar/${result.slug}`
        return (
            <div className="group max-w-[600px] mb-6">
                <div className="flex items-center gap-1.5 text-sm mb-0.5">
                    <span className="text-sm text-foreground/70">lingocon.com</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">{result.language.slug}</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">grammar</span>
                </div>
                <Link href={url} className="block">
                    <h3 className="text-xl leading-snug text-primary hover:underline cursor-pointer">
                        {highlightMatch(result.title, query)}
                    </h3>
                </Link>
                <p className="text-sm leading-relaxed text-foreground/80 mt-0.5 line-clamp-2">
                    Grammar documentation for <span className="font-medium">{result.language.name}</span>: {result.title}
                </p>
            </div>
        )
    }

    if (result.type === "article") {
        const url = `/lang/${result.language.slug}/articles/${result.slug}`
        return (
            <div className="group max-w-[600px] mb-6">
                <div className="flex items-center gap-1.5 text-sm mb-0.5">
                    <span className="text-sm text-foreground/70">lingocon.com</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">{result.language.slug}</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">articles</span>
                </div>
                <Link href={url} className="block">
                    <h3 className="text-xl leading-snug text-primary hover:underline cursor-pointer">
                        {highlightMatch(result.title, query)}
                    </h3>
                </Link>
                <p className="text-sm leading-relaxed text-foreground/80 mt-0.5 line-clamp-2">
                    <span className="font-medium">{result.language.name}</span>{" — "}
                    {result.excerpt || "Read the full article."}
                </p>
            </div>
        )
    }

    if (result.type === "text") {
        const url = `/lang/${result.language.slug}/texts/${result.slug}`
        return (
            <div className="group max-w-[600px] mb-6">
                <div className="flex items-center gap-1.5 text-sm mb-0.5">
                    <span className="text-sm text-foreground/70">lingocon.com</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">{result.language.slug}</span>
                    <span className="text-sm text-foreground/50">›</span>
                    <span className="text-sm text-foreground/70">texts</span>
                </div>
                <Link href={url} className="block">
                    <h3 className="text-xl leading-snug text-primary hover:underline cursor-pointer">
                        {highlightMatch(result.title, query)}
                    </h3>
                </Link>
                <p className="text-sm leading-relaxed text-foreground/80 mt-0.5 line-clamp-2">
                    <span className="font-medium">{result.language.name}</span>{" — "}
                    {result.description || "Read the translated text."}
                </p>
            </div>
        )
    }

    return null
}
