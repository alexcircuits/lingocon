"use client"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Lock } from "lucide-react"

export type BadgeTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM"
export type BadgeCategory = "LANGUAGES" | "DICTIONARY" | "GRAMMAR" | "SCRIPT" | "SOCIAL" | "CONTENT" | "ENGAGEMENT"

export interface BadgeData {
    id: string
    key: string
    name: string
    description: string
    icon: string
    tier: BadgeTier
    category: BadgeCategory
    threshold: number
    progress: number
    earnedAt: Date | null
    isEarned: boolean
}

interface BadgeCardProps {
    badge: BadgeData
    size?: "sm" | "md" | "lg"
    showProgress?: boolean
    showTooltip?: boolean
    className?: string
}

const tierColors: Record<BadgeTier, { bg: string; border: string; glow: string; text: string }> = {
    BRONZE: {
        bg: "bg-amber-900/10",
        border: "border-amber-700/50",
        glow: "shadow-amber-500/30",
        text: "text-amber-700 dark:text-amber-500",
    },
    SILVER: {
        bg: "bg-slate-400/10",
        border: "border-slate-400/50",
        glow: "shadow-slate-400/30",
        text: "text-slate-600 dark:text-slate-400",
    },
    GOLD: {
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/50",
        glow: "shadow-yellow-400/40",
        text: "text-yellow-600 dark:text-yellow-400",
    },
    PLATINUM: {
        bg: "bg-gradient-to-br from-violet-500/10 to-cyan-500/10",
        border: "border-violet-400/50",
        glow: "shadow-violet-400/40",
        text: "text-violet-600 dark:text-violet-400",
    },
}

const sizeClasses = {
    sm: {
        container: "w-12 h-12",
        icon: "text-xl",
        lock: "h-3 w-3",
    },
    md: {
        container: "w-16 h-16",
        icon: "text-2xl",
        lock: "h-4 w-4",
    },
    lg: {
        container: "w-20 h-20",
        icon: "text-3xl",
        lock: "h-5 w-5",
    },
}

export function BadgeCard({
    badge,
    size = "md",
    showProgress = true,
    showTooltip = true,
    className,
}: BadgeCardProps) {
    const colors = tierColors[badge.tier]
    const sizes = sizeClasses[size]
    const progressPercent = Math.min((badge.progress / badge.threshold) * 100, 100)

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const badgeContent = (
        <div
            className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300",
                badge.isEarned
                    ? cn(colors.bg, colors.border, "shadow-lg", colors.glow)
                    : "bg-muted/30 border-border/40 grayscale-[0.7] opacity-60",
                "hover:scale-105",
                className
            )}
        >
            {/* Badge Icon */}
            <div
                className={cn(
                    "flex items-center justify-center rounded-xl",
                    sizes.container,
                    badge.isEarned ? colors.bg : "bg-muted/50"
                )}
            >
                {badge.isEarned ? (
                    <span className={cn(sizes.icon, "select-none")}>{badge.icon}</span>
                ) : (
                    <Lock className={cn(sizes.lock, "text-muted-foreground/50")} />
                )}
            </div>

            {/* Badge Name */}
            <div className="text-center">
                <p
                    className={cn(
                        "font-medium text-sm leading-tight",
                        badge.isEarned ? colors.text : "text-muted-foreground"
                    )}
                >
                    {badge.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {badge.tier.toLowerCase()}
                </p>
            </div>

            {/* Progress Bar (for unearned badges) */}
            {showProgress && !badge.isEarned && badge.progress > 0 && (
                <div className="w-full mt-1">
                    <Progress value={progressPercent} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-center mt-1">
                        {badge.progress} / {badge.threshold}
                    </p>
                </div>
            )}
        </div>
    )

    if (!showTooltip) {
        return badgeContent
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-center">
                    <p className="font-medium">{badge.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                    {badge.isEarned && badge.earnedAt && (
                        <p className="text-xs text-primary mt-2">
                            Earned on {formatDate(badge.earnedAt)}
                        </p>
                    )}
                    {!badge.isEarned && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Progress: {badge.progress} / {badge.threshold}
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// Compact badge for inline display (profile header)
export function BadgeIcon({
    badge,
    size = "sm",
    className,
}: {
    badge: BadgeData
    size?: "xs" | "sm" | "md"
    className?: string
}) {
    const colors = tierColors[badge.tier]

    const sizeMap = {
        xs: "w-6 h-6 text-sm",
        sm: "w-8 h-8 text-base",
        md: "w-10 h-10 text-lg",
    }

    if (!badge.isEarned) return null

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "flex items-center justify-center rounded-lg border",
                            sizeMap[size],
                            colors.bg,
                            colors.border,
                            "shadow-sm hover:scale-110 transition-transform cursor-pointer",
                            className
                        )}
                    >
                        <span className="select-none">{badge.icon}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p className="font-medium">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
