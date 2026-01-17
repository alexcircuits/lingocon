"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { BadgeCard, BadgeData, BadgeCategory } from "./badge-card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Globe,
    BookOpen,
    FileText,
    Type,
    Users,
    Newspaper,
    Sparkles
} from "lucide-react"

interface BadgeGridProps {
    badges: BadgeData[]
    showFilters?: boolean
    showProgress?: boolean
    className?: string
}

const categoryConfig: Record<BadgeCategory | "ALL", { label: string; icon: React.ElementType }> = {
    ALL: { label: "All", icon: Sparkles },
    LANGUAGES: { label: "Languages", icon: Globe },
    DICTIONARY: { label: "Dictionary", icon: BookOpen },
    GRAMMAR: { label: "Grammar", icon: FileText },
    SCRIPT: { label: "Script", icon: Type },
    SOCIAL: { label: "Social", icon: Users },
    CONTENT: { label: "Content", icon: Newspaper },
    ENGAGEMENT: { label: "Engagement", icon: Sparkles },
}

export function BadgeGrid({
    badges,
    showFilters = true,
    showProgress = true,
    className,
}: BadgeGridProps) {
    const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | "ALL">("ALL")

    // Filter badges by category
    const filteredBadges = selectedCategory === "ALL"
        ? badges
        : badges.filter((b) => b.category === selectedCategory)

    // Sort: earned first, then by tier, then by progress
    const sortedBadges = [...filteredBadges].sort((a, b) => {
        // Earned badges first
        if (a.isEarned !== b.isEarned) return a.isEarned ? -1 : 1
        // Then by tier
        const tierOrder = { PLATINUM: 0, GOLD: 1, SILVER: 2, BRONZE: 3 }
        if (tierOrder[a.tier] !== tierOrder[b.tier]) {
            return tierOrder[a.tier] - tierOrder[b.tier]
        }
        // Then by progress percentage
        const aProgress = a.progress / a.threshold
        const bProgress = b.progress / b.threshold
        return bProgress - aProgress
    })

    // Get available categories (ones that have badges)
    const availableCategories = new Set(badges.map((b) => b.category))

    // Stats
    const earnedCount = badges.filter((b) => b.isEarned).length
    const totalCount = badges.length

    return (
        <div className={cn("space-y-6", className)}>
            {/* Stats Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Achievements</h3>
                    <p className="text-sm text-muted-foreground">
                        {earnedCount} of {totalCount} badges earned
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-serif font-medium text-primary">
                        {Math.round((earnedCount / totalCount) * 100)}%
                    </span>
                    <p className="text-xs text-muted-foreground">Complete</p>
                </div>
            </div>

            {/* Category Filters */}
            {showFilters && (
                <Tabs
                    value={selectedCategory}
                    onValueChange={(v) => setSelectedCategory(v as BadgeCategory | "ALL")}
                    className="w-full"
                >
                    <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
                        {(["ALL", ...Object.keys(categoryConfig).filter(k => k !== "ALL")] as const).map((key) => {
                            const cat = key as BadgeCategory | "ALL"
                            if (cat !== "ALL" && !availableCategories.has(cat as BadgeCategory)) return null
                            const config = categoryConfig[cat]
                            const Icon = config.icon
                            return (
                                <TabsTrigger
                                    key={cat}
                                    value={cat}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{config.label}</span>
                                </TabsTrigger>
                            )
                        })}
                    </TabsList>
                </Tabs>
            )}

            {/* Badge Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedBadges.map((badge) => (
                    <BadgeCard
                        key={badge.id}
                        badge={badge}
                        showProgress={showProgress}
                    />
                ))}
            </div>

            {/* Empty State */}
            {sortedBadges.length === 0 && (
                <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No badges in this category yet</p>
                </div>
            )}
        </div>
    )
}
