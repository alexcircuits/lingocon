"use client"

import Link from "next/link"
import { motion } from "motion/react"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]">
            {sections.map((section, idx) => {
                const Icon = iconMap[section.iconName]
                const isWide = idx === 0 || idx === 3 // Make first and fourth item wide for visual interest

                return (
                    <Link
                        key={section.title}
                        href={section.href}
                        className={cn(
                            "group relative overflow-hidden rounded-3xl border border-border/40 bg-card hover:bg-secondary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 block",
                            isWide ? "md:col-span-2" : "md:col-span-1"
                        )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="p-6 h-full flex flex-col justify-between relative z-10">
                            <div className="flex justify-between items-start">
                                <div className={cn("p-3 rounded-2xl bg-background/80 backdrop-blur-sm border border-border/50", section.color)}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="px-3 py-1 rounded-full bg-secondary/50 border border-border/20 text-xs font-mono font-medium">
                                    {section.count} Items
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-medium mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                                    {section.title}
                                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    View full {section.title.toLowerCase()} documentation
                                </p>
                            </div>
                        </div>

                        {/* Decorative background icon */}
                        <Icon className="absolute -bottom-4 -right-4 h-32 w-32 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity -rotate-12" />
                    </Link>
                )
            })}
        </div>
    )
}
