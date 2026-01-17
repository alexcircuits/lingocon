"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { BadgeWithProgress } from "./badge"

/**
 * Get earned badges that haven't been notified to the user yet
 */
export async function getUnnotifiedBadges(userId?: string): Promise<BadgeWithProgress[]> {
    const targetUserId = userId || (await getUserId())

    if (!targetUserId) {
        return []
    }

    const unnotifiedBadges = await prisma.userBadge.findMany({
        where: {
            userId: targetUserId,
            earnedAt: { not: null },
            notified: false,
        },
        include: {
            badge: true,
        },
        orderBy: {
            earnedAt: "asc", // Show oldest first -> chronological order
        },
    })

    return unnotifiedBadges.map((ub) => ({
        id: ub.badge.id,
        key: ub.badge.key,
        name: ub.badge.name,
        description: ub.badge.description,
        icon: ub.badge.icon,
        tier: ub.badge.tier,
        category: ub.badge.category,
        threshold: ub.badge.threshold,
        progress: ub.progress,
        earnedAt: ub.earnedAt,
        isEarned: true,
        userBadgeId: ub.id // Helper for marking as read
    } as any))
}

/**
 * Mark badges as notified so they don't show up again
 */
export async function markBadgesAsNotified(badgeIds: string[]) {
    const userId = await getUserId()
    if (!userId || badgeIds.length === 0) return

    await prisma.userBadge.updateMany({
        where: {
            userId,
            badgeId: { in: badgeIds },
        },
        data: {
            notified: true,
        },
    })
}
