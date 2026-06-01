"use client"

import { useState, useEffect } from "react"
import { Language } from "@prisma/client"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/favorite-button"
import { ShareButtons } from "@/components/share-buttons"
import {
    Flag,
    Globe,
    MessageCircle,
    MessageSquare,
    GitBranch,
    Heart,
    FileText,
    BookOpen,
    Languages,
    Newspaper,
    BookMarked,
} from "lucide-react"

interface LanguageHeroProps {
    language: Pick<
        Language,
        | "id"
        | "name"
        | "slug"
        | "description"
        | "visibility"
        | "flagUrl"
        | "discordUrl"
        | "telegramUrl"
        | "websiteUrl"
        | "createdAt"
        | "updatedAt"
        | "ownerId"
    > & {
        _count: {
            favorites: number
            scriptSymbols?: number
            grammarPages?: number
            dictionaryEntries?: number
            articles?: number
            texts?: number
        }
    }
    isFavorite: boolean
    userId: string | null
}

export function LanguageHero({ language, isFavorite, userId }: LanguageHeroProps) {
    const [shareUrl, setShareUrl] = useState("")

    useEffect(() => {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
        setShareUrl(`${siteUrl}/lang/${language.slug}`)
    }, [language.slug])

    const c = language._count
    const stats = [
        { label: "Words", value: c.dictionaryEntries ?? 0, icon: FileText },
        { label: "Grammar", value: c.grammarPages ?? 0, icon: BookOpen },
        { label: "Symbols", value: c.scriptSymbols ?? 0, icon: Languages },
        { label: "Articles", value: c.articles ?? 0, icon: Newspaper },
        { label: "Texts", value: c.texts ?? 0, icon: BookMarked },
    ].filter((s) => s.value > 0)

    return (
        <div className="aurora-glass relative w-full overflow-hidden rounded-3xl">
            {/* Aurora ambient blobs */}
            <div
                className="aurora-blob aurora-blob-animate -left-16 -top-24 h-64 w-64"
                style={{ background: "hsl(var(--aurora-violet))" }}
            />
            <div
                className="aurora-blob aurora-blob-animate -bottom-28 right-0 h-72 w-72"
                style={{ background: "hsl(var(--aurora-magenta))", animationDelay: "-7s" }}
            />

            <div className="relative z-10 flex flex-col items-start gap-7 p-6 md:flex-row md:items-center md:gap-9 md:p-10 lg:p-12">
                {/* Flag / Cover */}
                <div className="group relative shrink-0">
                    <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-primary/40 to-primary/5 opacity-70 blur transition duration-700 group-hover:opacity-100" />
                    {language.flagUrl ? (
                        <div className="relative h-32 w-48 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl md:h-40 md:w-60">
                            <Image
                                src={language.flagUrl}
                                alt={`Flag of the ${language.name} constructed language`}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                priority
                            />
                        </div>
                    ) : (
                        <div className="relative flex h-32 w-48 items-center justify-center rounded-2xl border border-border/50 bg-card/70 shadow-xl backdrop-blur-sm md:h-40 md:w-60">
                            <Flag className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-5">
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge
                                variant="outline"
                                className="border-primary/20 bg-primary/5 text-primary backdrop-blur-md"
                            >
                                {language.visibility}
                            </Badge>
                            <div className="flex items-center gap-2">
                                {language.discordUrl && (
                                    <Link
                                        href={language.discordUrl}
                                        target="_blank"
                                        aria-label="Discord"
                                        className="text-muted-foreground transition-colors hover:text-[#5865F2]"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                    </Link>
                                )}
                                {language.telegramUrl && (
                                    <Link
                                        href={language.telegramUrl}
                                        target="_blank"
                                        aria-label="Telegram"
                                        className="text-muted-foreground transition-colors hover:text-[#0088cc]"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                    </Link>
                                )}
                                {language.websiteUrl && (
                                    <Link
                                        href={language.websiteUrl}
                                        target="_blank"
                                        aria-label="Website"
                                        className="text-muted-foreground transition-colors hover:text-primary"
                                    >
                                        <Globe className="h-4 w-4" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl lg:text-7xl">
                            {language.name}
                        </h1>
                    </div>

                    {language.description && (
                        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                            {language.description}
                        </p>
                    )}

                    {/* Inline stats */}
                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary">
                            <Heart className="h-3.5 w-3.5" />
                            <span className="font-semibold tabular-nums">{c.favorites}</span>
                            <span className="text-primary/70">Favorites</span>
                        </span>
                        {stats.map((s) => {
                            const Icon = s.icon
                            return (
                                <span
                                    key={s.label}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1 text-sm backdrop-blur-sm"
                                >
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-semibold tabular-nums">{s.value}</span>
                                    <span className="text-muted-foreground">{s.label}</span>
                                </span>
                            )
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <FavoriteButton
                            languageId={language.id}
                            isFavorite={isFavorite}
                            favoriteCount={language._count.favorites}
                            className="h-10 rounded-full px-6 shadow-sm transition-all hover:shadow-md"
                        />

                        {userId && userId !== language.ownerId && language.visibility === "PUBLIC" && (
                            <Link href={`/dashboard/new-language?from=${language.slug}`}>
                                <Badge
                                    variant="secondary"
                                    className="flex h-10 cursor-pointer items-center gap-2 rounded-full px-6 hover:bg-secondary/80"
                                >
                                    <GitBranch className="h-4 w-4" />
                                    Fork &amp; Evolve
                                </Badge>
                            </Link>
                        )}

                        <ShareButtons
                            url={shareUrl}
                            title={language.name}
                            description={language.description || undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
