"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"

// Simple shapes to simulate scripts without needing fonts
const SCRIPTS = [
    { name: "Geometric", chars: ["△", "○", "□", "◇", "▽", "⬡"] },
    { name: "Cursive", chars: ["ℓ", "α", "η", "ℊ", "υ", "α"] },
    { name: "Runes", chars: ["ᚪ", "ᚳ", "ᚷ", "ᛚ", "ᛗ", "ᛟ"] },
    { name: "Logographic", chars: ["雨", "水", "林", "火", "山", "人"] }, // Placeholders
]

export function ScriptCard() {
    const [currentScript, setCurrentScript] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentScript((prev) => (prev + 1) % SCRIPTS.length)
        }, 3000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="flex flex-col h-full w-full bg-background border rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-4 left-4 flex gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400/50" />
                <div className="w-2 h-2 rounded-full bg-yellow-400/50" />
                <div className="w-2 h-2 rounded-full bg-green-400/50" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="flex space-x-1">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentScript}
                            className="flex space-x-1"
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            {SCRIPTS[currentScript].chars.map((char, i) => (
                                <motion.div
                                    key={`${currentScript}-${i}`}
                                    initial={{ opacity: 0, y: 10, rotateX: 90 }}
                                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                    exit={{ opacity: 0, y: -10, rotateX: -90 }}
                                    transition={{ delay: i * 0.1, duration: 0.4 }}
                                    className="text-4xl sm:text-5xl font-light text-foreground"
                                >
                                    {char}
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <motion.div
                    key={SCRIPTS[currentScript].name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs uppercase tracking-widest text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full"
                >
                    {SCRIPTS[currentScript].name} Script
                </motion.div>
            </div>

            {/* Grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none -z-10" />
        </div>
    )
}
