"use client"

import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
// From its own module: importing it from the toast module put the animation library back in
// the root bundle that every page downloads.
import { useAchievementToast } from "./badges/use-achievement-toast"
import { markBadgesAsNotified } from "@/app/actions/badge-notifications"
import type { BadgeData } from "./badges/badge-card"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"

// The toast pulls in the animation library; load it only when a badge is shown
// instead of in the root bundle every page downloads.
const AchievementToast = dynamic(
    () => import("./badges/achievement-toast").then((m) => m.AchievementToast),
    { ssr: false }
)

/** Minimum gap between badge checks triggered by navigation. */
const CHECK_INTERVAL_MS = 15_000

async function fetchUnnotifiedBadges(signal: AbortSignal): Promise<BadgeData[]> {
    const response = await fetch("/api/me/badges", { cache: "no-store", signal })
    if (!response.ok) throw new Error(`Badge check failed: ${response.status}`)
    const body = (await response.json()) as { badges?: BadgeData[] }
    return Array.isArray(body.badges) ? body.badges : []
}

export function AchievementListener() {
    const { badge, showAchievement, dismiss } = useAchievementToast()
    const { data: session } = useSession()
    const userId = session?.user?.id
    const pathname = usePathname()
    // Badges already shown in this tab (also guards React strict-mode double effects).
    const processedRef = useRef<Set<string>>(new Set())
    const lastCheckRef = useRef(0)

    useEffect(() => {
        if (!userId) return
        // Badges are earned by saves elsewhere in the app; checking on navigation is
        // enough to surface them promptly without a request per click.
        if (Date.now() - lastCheckRef.current < CHECK_INTERVAL_MS) return
        lastCheckRef.current = Date.now()

        const controller = new AbortController()
        let fetched = false
        const checkAchievements = async () => {
            try {
                const newBadges = await fetchUnnotifiedBadges(controller.signal)
                fetched = true
                const uniqueBadges = newBadges.filter((b) => !processedRef.current.has(b.id))
                if (uniqueBadges.length === 0) return

                uniqueBadges.forEach((earned) => {
                    showAchievement(earned)
                    processedRef.current.add(earned.id)
                })
                // Marked after queuing the toasts so a failed write never hides a badge.
                await markBadgesAsNotified(uniqueBadges.map((b) => b.id))
            } catch (error) {
                if (controller.signal.aborted) return
                console.error("Failed to check achievements:", error)
            }
        }

        checkAchievements()
        return () => {
            // Interrupted before the server answered (e.g. the next navigation):
            // nothing was checked, so don't let the throttle skip the next run.
            // Cleanup runs before the next effect, so the reset is seen in time.
            if (!fetched) lastCheckRef.current = 0
            controller.abort()
        }
    }, [userId, pathname, showAchievement])

    if (!badge) return null

    return <AchievementToast badge={badge} onDismiss={dismiss} />
}
