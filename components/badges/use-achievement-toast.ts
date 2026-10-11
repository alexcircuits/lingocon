"use client"

import { useCallback, useState } from "react"
import type { BadgeData } from "./badge-card"

/**
 * State for the achievement toast. Kept apart from the toast component: the root layout's
 * listener needs this hook on every page, while the toast (and its animation library) loads
 * only when a badge is actually shown.
 */
export function useAchievementToast() {
    const [badge, setBadge] = useState<BadgeData | null>(null)

    // Stable identities: consumers list these in effect dependencies.
    const showAchievement = useCallback((newBadge: BadgeData) => {
        setBadge(newBadge)
    }, [])

    const dismiss = useCallback(() => {
        setBadge(null)
    }, [])

    return {
        badge,
        showAchievement,
        dismiss,
    }
}
