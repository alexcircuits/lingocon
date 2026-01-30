"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import type { Language, User as UserType } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Heart } from "lucide-react"

// Generate a consistent gradient based on the language name
function getGradientFromName(name: string): [string, string] {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    const gradients: [string, string][] = [
        ["#667eea", "#764ba2"],
        ["#f093fb", "#f5576c"],
        ["#4facfe", "#00f2fe"],
        ["#43e97b", "#38f9d7"],
        ["#fa709a", "#fee140"],
        ["#a8edea", "#fed6e3"],
        ["#ff9a9e", "#fad0c4"],
        ["#ffecd2", "#fcb69f"],
        ["#a18cd1", "#fbc2eb"],
        ["#fad0c4", "#ffd1ff"],
        ["#667eea", "#f093fb"],
        ["#00c6fb", "#005bea"],
        ["#d299c2", "#fef9d7"],
        ["#89f7fe", "#66a6ff"],
        ["#cd9cf2", "#f6f3ff"],
        ["#fddb92", "#d1fdff"],
    ]
    return gradients[Math.abs(hash) % gradients.length]
}

interface BookCardProps {
    language: Language & {
        owner: Pick<UserType, "id" | "name" | "image">
        _count: {
            scriptSymbols: number
            grammarPages: number
            dictionaryEntries: number
            favorites?: number
        }
        flagUrl?: string | null
    }
}

export function BookCard({ language }: BookCardProps) {
    return (
        <Link href={`/lang/${language.slug}`} className="block group perspective-1000">
            <motion.div
                whileHover={{ y: -5, rotateY: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative bg-card border-none rounded-none shadow-xl flex flex-col h-[320px] w-full max-w-[260px] mx-auto overflow-hidden preserve-3d group-hover:shadow-2xl transition-all duration-500"
            >
                {/* Spine/Side (Simulated) */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-primary/20 bg-gradient-to-r from-black/20 to-transparent z-20" />

                {/* Cover Image/Color */}
                <div className="absolute inset-0 bg-secondary flex flex-col">
                    {language.flagUrl ? (
                        <div className="h-1/2 relative overflow-hidden">
                            <Image
                                src={language.flagUrl}
                                alt={language.name}
                                fill
                                className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-primary/10 mix-blend-multiply" />
                        </div>
                    ) : (
                        <div
                            className="h-1/2 relative overflow-hidden flex items-center justify-center"
                            style={{
                                background: `linear-gradient(135deg, ${getGradientFromName(language.name)[0]}, ${getGradientFromName(language.name)[1]})`,
                            }}
                        >
                            <span className="text-5xl font-serif font-bold text-white/30 select-none">
                                {language.name.slice(0, 2).toUpperCase()}
                            </span>
                        </div>
                    )}

                    <div className="h-1/2 bg-card p-6 flex flex-col justify-between border-t border-border/10 relative">
                        {/* Texture overlay */}
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 pointer-events-none" />

                        <div>
                            <h3 className="font-serif text-2xl font-medium tracking-tight text-foreground line-clamp-2 leading-none mb-2 group-hover:text-primary transition-colors">
                                {language.name}
                            </h3>
                            <p className="text-sm text-muted-foreground font-medium">
                                by {language.owner.name}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="w-full h-px bg-border/50" />
                            <div className="flex justify-between items-center text-xs font-mono text-muted-foreground/80 uppercase tracking-widest">
                                <span>{language._count.dictionaryEntries} w.</span>
                                <div className="flex items-center gap-1">
                                    <Heart className="h-3 w-3 fill-rose-500/20 text-rose-500" />
                                    <span>{language._count.favorites || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    )
}
