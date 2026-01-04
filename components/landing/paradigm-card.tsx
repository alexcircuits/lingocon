"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const DATA = [
    { person: "1SG", present: "amo", past: "amavi" },
    { person: "2SG", present: "amas", past: "amavisti" },
    { person: "3SG", present: "amat", past: "amavit" },
    { person: "1PL", present: "amamus", past: "amavimus" },
    { person: "2PL", present: "amatis", past: "amavistis" },
    { person: "3PL", present: "amant", past: "amaverunt" },
]

export function ParadigmCard() {
    const [hoveredRow, setHoveredRow] = useState<number | null>(null)

    return (
        <div className="flex flex-col h-full w-full bg-background border rounded-xl overflow-hidden p-6 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-transparent" />

            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Conjugation Table</h3>
                <div className="text-xs text-rose-500 font-mono">CLASS I</div>
            </div>

            <div className="w-full text-sm font-mono">
                <div className="grid grid-cols-3 gap-2 pb-2 text-muted-foreground text-xs border-b border-rose-500/20 mb-2">
                    <div>PRS</div>
                    <div>PRES</div>
                    <div>PAST</div>
                </div>

                <div className="space-y-1">
                    {DATA.map((row, i) => (
                        <div
                            key={i}
                            onMouseEnter={() => setHoveredRow(i)}
                            onMouseLeave={() => setHoveredRow(null)}
                            className={cn(
                                "grid grid-cols-3 gap-2 py-1 rounded cursor-crosshair transition-colors",
                                hoveredRow === i ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "text-foreground/80"
                            )}
                        >
                            <div className="opacity-50">{row.person}</div>
                            <div className={cn(hoveredRow === i && "font-bold")}>{row.present}</div>
                            <div className={cn(hoveredRow === i && "font-bold")}>{row.past}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
