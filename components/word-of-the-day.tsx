import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Volume2 } from "lucide-react"
import { getWordOfTheDay } from "@/app/actions/word"
import { FontLoader } from "@/components/font-loader"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import type { ScriptSymbol } from "@prisma/client"

export async function WordOfTheDay() {
    const word = await getWordOfTheDay()

    if (!word) {
        return null
    }

    const { language } = word
    const latinLemma = language.scriptSymbols && language.scriptSymbols.length > 0
        ? transliterateToLatin(word.lemma, language.scriptSymbols as ScriptSymbol[])
        : word.lemma
    const hasTransliteration = latinLemma !== word.lemma

    return (
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 p-6 shadow-sm hover:shadow-md transition-all">
            <FontLoader
                fontUrl={language.fontUrl}
                fontFamily={language.fontFamily}
                fontScale={language.fontScale}
            />
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Word of the Day
                </span>
            </div>

            {/* Word */}
            <div className="mb-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                    <div className="flex flex-col">
                        <h3 className="text-3xl md:text-4xl font-serif font-medium text-foreground font-custom-script">
                            {word.lemma}
                        </h3>
                        {hasTransliteration && (
                            <span className="text-sm text-muted-foreground font-custom-script mt-1">
                                {latinLemma}
                            </span>
                        )}
                    </div>
                    {word.partOfSpeech && (
                        <Badge variant="secondary" className="text-xs font-mono self-start mt-2">
                            {word.partOfSpeech}
                        </Badge>
                    )}
                </div>

                {word.ipa && (
                    <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                        <Volume2 className="h-3.5 w-3.5" />
                        <span className="font-mono text-sm">/{word.ipa}/</span>
                    </div>
                )}
            </div>

            {/* Definition */}
            <p className="text-lg text-foreground/80 mb-4 leading-relaxed">
                {word.gloss}
            </p>

            {/* Language Link */}
            <Link
                href={`/lang/${word.language.slug}/dictionary`}
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors group"
            >
                {word.language.flagUrl && (
                    <Image
                        src={word.language.flagUrl}
                        alt={`${word.language.name} flag`}
                        width={16}
                        height={12}
                        className="w-4 h-3 rounded-sm object-cover"
                    />
                )}
                <span className="font-medium">{word.language.name}</span>
                <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform">
                    →
                </span>
            </Link>

            {/* Decorative element */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
        </div>
    )
}
