"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

const GLOSS_DATA = [
    { word: "Nyan", gloss: "1SG", type: "PRON" },
    { word: "karo-la", gloss: "sky-ACC", type: "N" },
    { word: "mita", gloss: "see", type: "V" },
    { word: "o", gloss: "PRS", type: "PTCL" },
]

export function GrammarCard() {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    return (
        <div className="flex flex-col h-full w-full justify-center p-6 bg-gradient-to-br from-violet-500/5 to-transparent border rounded-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-50 font-mono text-[10px] text-violet-500">GLOSS // V1</div>

            <div className="flex space-x-3 text-lg justify-center">
                {GLOSS_DATA.map((item, i) => (
                    <div
                        key={i}
                        className="flex flex-col items-center cursor-help group/word"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className={cn(
                            "font-serif font-medium transition-colors duration-200",
                            hoveredIndex === i ? "text-violet-600 dark:text-violet-400" : "text-foreground"
                        )}>
                            {item.word}
                        </div>
                        <div className="h-px w-full bg-border my-1 group-hover/word:bg-violet-500/50 transition-colors" />
                        <div className={cn(
                            "font-mono text-xs uppercase transition-colors duration-200",
                            hoveredIndex === i ? "text-violet-600 dark:text-violet-400 font-bold" : "text-muted-foreground"
                        )}>
                            {item.gloss}
                        </div>
                        {hoveredIndex === i && (
                            <span className="text-muted-foreground text-xs mt-2 text-center max-w-[100px]">
                                The word for &quot;cat&quot; (māo) creates a pun with &quot;hair&quot; (máo).
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-center text-sm text-foreground/80 italic font-medium"
            >
                &quot;I see the sky.&quot;
            </motion.div>

            {/* Background decoration */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-colors duration-500" />
        </div>
    )
}
