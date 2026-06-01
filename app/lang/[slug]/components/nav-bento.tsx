"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Languages, BookOpen, FileText, Newspaper, BookMarked, AudioWaveform, ArrowRight } from "lucide-react"

interface NavSection {
    title: string
    count: number
    href: string
    iconName: "Languages" | "BookOpen" | "FileText" | "Newspaper" | "BookMarked" | "AudioWaveform"
    color: string
}

interface NavBentoProps {
    sections: NavSection[]
}

const iconMap = {
    Languages,
    BookOpen,
    FileText,
    Newspaper,
    BookMarked,
    AudioWaveform,
}

export function NavBento({ sections }: NavBentoProps) {
    return (
        <div className="grid auto-rows-[minmax(170px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {sections.map((section, idx) => {
                const Icon = iconMap[section.iconName]
                const isWide = idx === 0 || idx === 3 // First & fourth span wide for rhythm

                return (
                    <Link
                        key={section.title}
                        href={section.href}
                        className={cn(
                            "group relative block overflow-hidden rounded-3xl aurora-glass p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10",
                            isWide ? "md:col-span-2" : "md:col-span-1",
                        )}
                    >
                        {/* hover wash */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                            <div className="flex items-start justify-between">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary backdrop-blur-sm">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-xs backdrop-blur-sm">
                                    <span className="font-semibold tabular-nums">{section.count}</span>
                                    <span className="text-muted-foreground">items</span>
                                </span>
                            </div>

                            <div>
                                <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight transition-colors group-hover:text-primary">
                                    {section.title}
                                    <ArrowRight className="h-4 w-4 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    View full {section.title.toLowerCase()} documentation
                                </p>
                            </div>
                        </div>

                        {/* Decorative background icon */}
                        <Icon className="pointer-events-none absolute -bottom-5 -right-5 h-32 w-32 -rotate-12 text-primary opacity-[0.04] transition-opacity duration-300 group-hover:opacity-[0.08]" />
                    </Link>
                )
            })}
        </div>
    )
}
