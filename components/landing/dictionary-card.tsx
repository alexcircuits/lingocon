"use client"

import { useState } from "react"
import { Search, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const SAMPLE_ENTRIES = [
    { word: "karo", type: "n.", def: "sky; void" },
    { word: "kali", type: "v.", def: "to fly" },
    { word: "kora", type: "adj.", def: "blue" },
    { word: "luma", type: "n.", def: "light" },
]

export function DictionaryCard() {
    const [query, setQuery] = useState("")
    const [isFocused, setIsFocused] = useState(false)

    const filtered = SAMPLE_ENTRIES.filter(e =>
        e.word.startsWith(query.toLowerCase())
    )

    return (
        <div className="flex flex-col h-full w-full bg-background border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 border-b bg-muted/30">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                        placeholder="Search lexicon..."
                        className="pl-9 bg-background border-muted-foreground/20 focus-visible:ring-primary/20"
                    />
                </div>
            </div>
            <div className="flex-1 p-2 relative overflow-hidden">
                <AnimatePresence>
                    <motion.div
                        className="space-y-1"
                        initial={false}
                        animate={{ opacity: 1 }}
                    >
                        {filtered.slice(0, 3).map((entry, i) => (
                            <motion.div
                                key={entry.word}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ delay: i * 0.05 }}
                                className="p-2 rounded-lg hover:bg-muted/50 flex items-center justify-between group cursor-pointer"
                            >
                                <div>
                                    <span className="font-bold text-md">{entry.word}</span>
                                    <span className="ml-2 text-xs text-muted-foreground italic">{entry.type}</span>
                                </div>
                                <span className="text-sm text-foreground/80">{entry.def}</span>
                            </motion.div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No matching entries found.
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Decorative fade at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            </div>
        </div>
    )
}
