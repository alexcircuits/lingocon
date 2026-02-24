import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Volume2 } from "lucide-react"
import { getWordOfTheDay } from "@/app/actions/word"

export async function WordOfTheDay() {
    const word = await getWordOfTheDay()

    if (!word) {
        return null
    }

    return (
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 p-6 shadow-sm hover:shadow-md transition-all">
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
                    <h3 className="text-3xl md:text-4xl font-serif font-medium text-foreground">
                        {word.lemma}
                    </h3>
                    {word.partOfSpeech && (
                        <Badge variant="secondary" className="text-xs font-mono">
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
                    <img
                        src={word.language.flagUrl}
                        alt=""
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
