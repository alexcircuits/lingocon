"use client"

import { useEffect, useRef } from "react"
import { useAchievementToast, AchievementToast } from "./badges/achievement-toast"
import { getUnnotifiedBadges, markBadgesAsNotified } from "@/app/actions/badge-notifications"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"

export function AchievementListener() {
    const { badge, showAchievement, dismiss } = useAchievementToast()
    const { data: session } = useSession()
    const pathname = usePathname()
    // Use a ref to track badges processed *in the current component lifecycle* to avoid React strict mode double-firing
    const processedRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!session?.user) return

        const checkAchievements = async () => {
            try {
                const newBadges = await getUnnotifiedBadges()

                if (newBadges.length > 0) {
                    // Filter: Only process badges we haven't seen in this session
                    const uniqueBadges = newBadges.filter(b => !processedRef.current.has(b.id))

                    if (uniqueBadges.length > 0) {
                        uniqueBadges.forEach(badge => {
                            // Show toast
                            showAchievement(badge)
                            // Mark as processed locally
                            processedRef.current.add(badge.id)
                        })

                        // Mark as notified in DB
                        // We do this *after* queuing toasts to ensure we don't miss any if the server call fails.
                        // Though arguably we should only mark if toast succeeds.
                        // But for UX, better to show it.
                        await markBadgesAsNotified(uniqueBadges.map(b => b.id))
                    }
                }
            } catch (error) {
                console.error("Failed to check achievements:", error)
            }
        }

        checkAchievements()

    }, [session, pathname, showAchievement]) // Only depend on these stable props

    if (!badge) return null

    return <AchievementToast badge={badge} onDismiss={dismiss} />
}
