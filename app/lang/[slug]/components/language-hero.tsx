"use client"

import { useState, useEffect } from "react"
import { Language } from "@prisma/client"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/favorite-button"
import { ShareButtons } from "@/components/share-buttons"
import { SparklesCore } from "@/components/ui/sparkles"
import { Flag, Globe, MessageCircle, MessageSquare, ExternalLink } from "lucide-react"

interface LanguageHeroProps {
    language: Pick<Language, "id" | "name" | "slug" | "description" | "visibility" | "flagUrl" | "discordUrl" | "telegramUrl" | "websiteUrl" | "createdAt" | "updatedAt"> & {
        _count: {
            favorites: number
        }
    }
    isFavorite: boolean
}

export function LanguageHero({ language, isFavorite }: LanguageHeroProps) {
    const [shareUrl, setShareUrl] = useState("")

    useEffect(() => {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
        setShareUrl(`${siteUrl}/lang/${language.slug}`)
    }, [language.slug])

    return (
        <div className="relative w-full overflow-hidden rounded-3xl border border-border/40 bg-background/50 shadow-2xl">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-primary/5 via-transparent to-background -z-10" />

            {/* Sparkles */}
            <div className="absolute inset-0 h-full w-full opacity-30 pointer-events-none">
                <SparklesCore
                    id={`hero-sparkles-${language.id}`}
                    background="transparent"
                    minSize={0.4}
                    maxSize={1}
                    particleDensity={20}
                    className="w-full h-full"
                    particleColor="currentColor"
                />
            </div>

            <div className="relative z-10 p-6 md:p-10 lg:p-14 flex flex-col md:flex-row gap-8 items-start">
                {/* Flag / Cover */}
                <div className="relative shrink-0 group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-70 group-hover:opacity-100 transition duration-1000"></div>
                    {language.flagUrl ? (
                        <div className="relative h-32 w-48 md:h-40 md:w-60 overflow-hidden rounded-xl border border-border/40 shadow-lg bg-card">
                            <Image
                                src={language.flagUrl}
                                alt={`${language.name} flag`}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                priority
                                unoptimized={language.flagUrl.startsWith("/uploads/")}
                            />
                        </div>
                    ) : (
                        <div className="flex h-32 w-48 md:h-40 md:w-60 items-center justify-center rounded-xl bg-secondary/30 border border-border/40 shadow-sm backdrop-blur-sm">
                            <Flag className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 backdrop-blur-md">
                                {language.visibility}
                            </Badge>
                            {/* Social Links */}
                            <div className="flex items-center gap-2">
                                {language.discordUrl && (
                                    <Link href={language.discordUrl} target="_blank" className="text-muted-foreground hover:text-[#5865F2] transition-colors">
                                        <MessageSquare className="h-4 w-4" />
                                    </Link>
                                )}
                                {language.telegramUrl && (
                                    <Link href={language.telegramUrl} target="_blank" className="text-muted-foreground hover:text-[#0088cc] transition-colors">
                                        <MessageCircle className="h-4 w-4" />
                                    </Link>
                                )}
                                {language.websiteUrl && (
                                    <Link href={language.websiteUrl} target="_blank" className="text-muted-foreground hover:text-primary transition-colors">
                                        <Globe className="h-4 w-4" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif font-medium tracking-tight text-foreground">
                            {language.name}
                        </h1>
                    </div>

                    {language.description && (
                        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl font-light">
                            {language.description}
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        <FavoriteButton
                            languageId={language.id}
                            isFavorite={isFavorite}
                            favoriteCount={language._count.favorites}
                            className="h-10 px-6 rounded-full shadow-sm hover:shadow-md transition-all"
                        />

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
