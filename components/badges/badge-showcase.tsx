"use client"

import { cn } from "@/lib/utils"
import { BadgeData, BadgeIcon } from "./badge-card"
import { Medal } from "lucide-react"
import Link from "next/link"

interface BadgeShowcaseProps {
    badges: BadgeData[]
    userId: string
    maxDisplay?: number
    className?: string
}

export function BadgeShowcase({
    badges,
    userId,
    maxDisplay = 5,
    className,
}: BadgeShowcaseProps) {
    // Get only earned badges, sorted by tier
    const earnedBadges = badges
        .filter((b) => b.isEarned)
        .sort((a, b) => {
            const tierOrder = { PLATINUM: 0, GOLD: 1, SILVER: 2, BRONZE: 3 }
            return tierOrder[a.tier] - tierOrder[b.tier]
        })

    const displayBadges = earnedBadges.slice(0, maxDisplay)
    const remainingCount = earnedBadges.length - maxDisplay

    if (earnedBadges.length === 0) {
        return null
    }

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {displayBadges.map((badge) => (
                <BadgeIcon key={badge.id} badge={badge} size="sm" />
            ))}

            {remainingCount > 0 && (
                <Link
                    href={`/users/${userId}?tab=badges`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 border border-border/40 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    +{remainingCount}
                </Link>
            )}
        </div>
    )
}

// Progress toward next badge
interface BadgeProgressProps {
    badges: BadgeData[]
    limit?: number
    className?: string
}

export function BadgeProgress({ badges, limit = 3, className }: BadgeProgressProps) {
    // Get badges with progress but not yet earned
    const inProgressBadges = badges
        .filter((b) => !b.isEarned && b.progress > 0)
        .sort((a, b) => {
            // Sort by closest to completion
            const aPercent = a.progress / a.threshold
            const bPercent = b.progress / b.threshold
            return bPercent - aPercent
        })
        .slice(0, limit)

    if (inProgressBadges.length === 0) {
        return null
    }

    return (
        <div className={cn("space-y-3", className)}>
            <div className="flex items-center gap-2 text-sm font-medium">
                <Medal className="h-4 w-4 text-primary" />
                <span>Next Achievements</span>
            </div>

            <div className="space-y-2">
                {inProgressBadges.map((badge) => {
                    const percent = Math.round((badge.progress / badge.threshold) * 100)
                    return (
                        <div
                            key={badge.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                            <span className="text-lg">{badge.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{badge.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-500"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {badge.progress}/{badge.threshold}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
