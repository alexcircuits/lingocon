"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { Languages, BookOpen, FileText, Heart, ArrowRight, GraduationCap } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

export type BookCardCategory =
    | "CONLANG"
    | "NATURAL"
    | "ENDANGERED"
    | "RESTORED"
    | "HISTORICAL"
    | "FICTIONAL"
    | "AUXILIARY"
    | "OTHER"

export interface BookCardLanguage {
    id: string
    name: string
    slug: string
    description?: string | null
    flagUrl?: string | null
    category?: BookCardCategory | string | null
    createdAt?: Date | string
    owner: { name: string | null; image?: string | null }
    _count: {
        scriptSymbols?: number
        grammarPages?: number
        dictionaryEntries: number
        favorites?: number
        courses?: number
    }
}

const CATEGORY_LABELS: Record<BookCardCategory, string> = {
    CONLANG: "Conlang",
    NATURAL: "Natural",
    ENDANGERED: "Endangered",
    RESTORED: "Restored",
    HISTORICAL: "Historical",
    FICTIONAL: "Fictional",
    AUXILIARY: "Auxiliary",
    OTHER: "Other",
}

function CategoryBadge({ category, className }: { category?: BookCardCategory | string | null; className?: string }) {
    if (!category || category === "CONLANG") return null
    const label = CATEGORY_LABELS[category as BookCardCategory] ?? null
    if (!label) return null
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground backdrop-blur",
                className,
            )}
        >
            {label}
        </span>
    )
}

function getGradientFromName(name: string): [string, string] {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i)
        hash &= hash
    }
    const gradients: [string, string][] = [
        ["#667eea", "#764ba2"],
        ["#f093fb", "#f5576c"],
        ["#4facfe", "#00f2fe"],
        ["#43e97b", "#38f9d7"],
        ["#fa709a", "#fee140"],
        ["#a18cd1", "#fbc2eb"],
        ["#00c6fb", "#005bea"],
        ["#89f7fe", "#66a6ff"],
        ["#cd9cf2", "#f6f3ff"],
        ["#fddb92", "#d1fdff"],
    ]
    return gradients[Math.abs(hash) % gradients.length]
}

function initials(name: string): string {
    const words = name.trim().split(/\s+/)
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
}

function Cover({
    name,
    flagUrl,
    className,
    textClassName,
}: {
    name: string
    flagUrl?: string | null
    className?: string
    textClassName?: string
}) {
    if (flagUrl) {
        return (
            <div className={cn("relative overflow-hidden", className)}>
                <Image
                    src={flagUrl}
                    alt={name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized={flagUrl.startsWith("/uploads/")}
                />
            </div>
        )
    }
    const [c1, c2] = getGradientFromName(name)
    return (
        <div
            className={cn("flex items-center justify-center overflow-hidden", className)}
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
            <span className={cn("font-bold text-white/45 select-none", textClassName)}>{initials(name)}</span>
        </div>
    )
}

function Stat({ icon: Icon, value }: { icon: React.ElementType; value: number }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground">
            <Icon className="h-3 w-3 text-primary" />
            <span className="tabular-nums">{value}</span>
        </span>
    )
}

function Stats({ language }: { language: BookCardLanguage }) {
    return (
        <>
            <Stat icon={FileText} value={language._count.dictionaryEntries} />
            <Stat icon={Languages} value={language._count.scriptSymbols ?? 0} />
            <Stat icon={BookOpen} value={language._count.grammarPages ?? 0} />
            <Stat icon={Heart} value={language._count.favorites ?? 0} />
        </>
    )
}

function LearnBadge({ language, className }: { language: BookCardLanguage; className?: string }) {
    if (!language._count.courses) return null
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm backdrop-blur",
                className
            )}
        >
            <GraduationCap className="h-3 w-3" />
            Learn
        </span>
    )
}

// A subtle vertical accent that keeps the "book spine" identity.
const Spine = () => (
    <div className="absolute left-0 top-0 bottom-0 z-10 w-1 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
)

interface BookCardProps {
    language: BookCardLanguage
    view?: "grid" | "list"
    className?: string
}

export function BookCard({ language, view = "grid", className }: BookCardProps) {
    if (view === "list") {
        return (
            <Link href={`/lang/${language.slug}`} className={cn("group block", className)}>
                <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl aurora-glass p-3 transition-colors hover:border-primary/30">
                    <Spine />
                    <Cover
                        name={language.name}
                        flagUrl={language.flagUrl}
                        className="h-14 w-20 shrink-0 rounded-xl"
                        textClassName="text-lg"
                    />
                    <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-1 font-semibold tracking-tight transition-colors group-hover:text-primary">
                            {language.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            by {language.owner.name || "Anonymous"}
                            {language.createdAt ? ` · ${formatDate(language.createdAt)}` : ""}
                        </p>
                        {language.description && (
                            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                                {language.description}
                            </p>
                        )}
                    </div>
                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <CategoryBadge category={language.category} />
                        <LearnBadge language={language} />
                        <Stats language={language} />
                    </div>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary md:block" />
                </div>
            </Link>
        )
    }

    return (
        <Link href={`/lang/${language.slug}`} className={cn("group block", className)}>
            <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative mx-auto h-[320px] w-full max-w-[260px] overflow-hidden rounded-l-none rounded-r-2xl aurora-glass transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-primary/10"
            >
                {/* Notebook binding: a flat-edged spine on the left + a fold line */}
                <div className="absolute left-0 top-0 bottom-0 z-20 w-2.5 bg-gradient-to-b from-primary/50 via-primary/30 to-primary/10" />
                <div className="absolute left-2.5 top-0 bottom-0 z-20 w-px bg-black/10 dark:bg-white/10" />

                <div className="flex h-full flex-col pl-2.5">
                    <div className="relative">
                        <Cover
                            name={language.name}
                            flagUrl={language.flagUrl}
                            className="h-[150px] w-full"
                            textClassName="text-5xl"
                        />
                        <LearnBadge language={language} className="absolute right-2 top-2 z-10" />
                        <CategoryBadge category={language.category} className="absolute left-3.5 top-2 z-10" />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                        <h3 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-primary">
                            {language.name}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">by {language.owner.name || "Anonymous"}</p>
                        {language.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{language.description}</p>
                        )}
                        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                            <Stats language={language} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    )
}
