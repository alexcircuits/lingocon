"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { BadgeData } from "./badge-card"
import { X, Trophy } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface AchievementToastProps {
    badge: BadgeData | null
    onDismiss: () => void
    duration?: number
}

const tierColors = {
    BRONZE: "from-amber-500/20 to-amber-600/20 border-amber-500/50",
    SILVER: "from-slate-400/20 to-slate-500/20 border-slate-400/50",
    GOLD: "from-yellow-400/20 to-yellow-500/20 border-yellow-500/50",
    PLATINUM: "from-violet-400/20 to-cyan-400/20 border-violet-400/50",
}

export function AchievementToast({ badge, onDismiss, duration = 5000 }: AchievementToastProps) {
    useEffect(() => {
        if (!badge) return

        const timer = setTimeout(onDismiss, duration)
        return () => clearTimeout(timer)
    }, [badge, duration, onDismiss])

    return (
        <AnimatePresence>
            {badge && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
                >
                    <div
                        className={cn(
                            "relative flex items-center gap-4 px-6 py-4 rounded-2xl border-2 shadow-2xl backdrop-blur-sm",
                            "bg-gradient-to-r",
                            tierColors[badge.tier]
                        )}
                    >
                        {/* Dismiss Button */}
                        <button
                            onClick={onDismiss}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>

                        {/* Trophy Icon */}
                        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-background/80 shadow-inner">
                            <span className="text-3xl">{badge.icon}</span>
                        </div>

                        {/* Content */}
                        <div className="pr-6">
                            <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider mb-1">
                                <Trophy className="h-3 w-3" />
                                Achievement Unlocked!
                            </div>
                            <h4 className="text-lg font-semibold">{badge.name}</h4>
                            <p className="text-sm text-muted-foreground">{badge.description}</p>
                        </div>

                        {/* Sparkle Effects */}
                        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                            {[...Array(6)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-yellow-400 rounded-full"
                                    initial={{
                                        opacity: 0,
                                        x: "50%",
                                        y: "50%",
                                    }}
                                    animate={{
                                        opacity: [0, 1, 0],
                                        x: `${Math.random() * 100}%`,
                                        y: `${Math.random() * 100}%`,
                                        scale: [0, 1.5, 0],
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        delay: i * 0.2,
                                        repeat: 2,
                                        ease: "easeOut",
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// Hook to manage achievement notifications
export function useAchievementToast() {
    const [badge, setBadge] = useState<BadgeData | null>(null)

    const showAchievement = (newBadge: BadgeData) => {
        setBadge(newBadge)
    }

    const dismiss = () => {
        setBadge(null)
    }

    return {
        badge,
        showAchievement,
        dismiss,
    }
}
