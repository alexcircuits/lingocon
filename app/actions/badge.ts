"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"

export type BadgeTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM"
export type BadgeCategory = "LANGUAGES" | "DICTIONARY" | "GRAMMAR" | "SCRIPT" | "SOCIAL" | "CONTENT" | "ENGAGEMENT"

export type BadgeWithProgress = {
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

/**
 * Get all badges with user's progress
 */
export async function getUserBadges(userId?: string): Promise<BadgeWithProgress[]> {
    const targetUserId = userId || (await getUserId())

    if (!targetUserId) {
        return []
    }

    const badges = await prisma.badge.findMany({
        include: {
            userBadges: {
                where: { userId: targetUserId },
            },
        },
        orderBy: [{ tier: "asc" }, { threshold: "asc" }],
    })

    return badges.map((badge) => {
        const userBadge = badge.userBadges[0]
        return {
            id: badge.id,
            key: badge.key,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            tier: badge.tier,
            category: badge.category,
            threshold: badge.threshold,
            progress: userBadge?.progress ?? 0,
            earnedAt: userBadge?.earnedAt ?? null,
            isEarned: userBadge?.earnedAt != null,
        }
    })
}

/**
 * Get only earned badges for a user (for profile display)
 */
export async function getEarnedBadges(userId: string): Promise<BadgeWithProgress[]> {
    const badges = await getUserBadges(userId)
    return badges.filter((b) => b.isEarned)
}

/**
 * Get badges that are close to being earned (for dashboard motivation)
 */
export async function getNextBadges(userId?: string, limit = 3): Promise<BadgeWithProgress[]> {
    const badges = await getUserBadges(userId)
    return badges
        .filter((b) => !b.isEarned && b.progress > 0)
        .sort((a, b) => b.progress / b.threshold - a.progress / a.threshold)
        .slice(0, limit)
}

/**
 * Update progress for a specific badge and auto-award if threshold met
 */
export async function updateBadgeProgress(
    userId: string,
    badgeKey: string,
    newProgress: number
): Promise<{ awarded: boolean; badge: Badge | null }> {
    const badge = await prisma.badge.findUnique({
        where: { key: badgeKey },
    })

    if (!badge) {
        return { awarded: false, badge: null }
    }

    const existingUserBadge = await prisma.userBadge.findUnique({
        where: {
            userId_badgeId: {
                userId,
                badgeId: badge.id,
            },
        },
    })

    // If already earned, don't update
    if (existingUserBadge?.earnedAt) {
        return { awarded: false, badge: null }
    }

    const shouldAward = newProgress >= badge.threshold

    const userBadge = await prisma.userBadge.upsert({
        where: {
            userId_badgeId: {
                userId,
                badgeId: badge.id,
            },
        },
        update: {
            progress: newProgress,
            earnedAt: shouldAward ? new Date() : null,
        },
        create: {
            userId,
            badgeId: badge.id,
            progress: newProgress,
            earnedAt: shouldAward ? new Date() : null,
        },
        include: {
            badge: true,
        },
    })

    if (shouldAward) {
        revalidatePath(`/users/${userId}`)
        revalidatePath("/dashboard")
    }

    return {
        awarded: shouldAward,
        badge: shouldAward ? userBadge.badge : null,
    }
}

// Type for the badge model
type Badge = {
    id: string
    key: string
    name: string
    description: string
    icon: string
    tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM"
    category: string
    threshold: number
}

/**
 * Check and update progress for language-related badges
 */
export async function checkLanguageBadges(userId: string) {
    const languageCount = await prisma.language.count({
        where: { ownerId: userId },
    })

    const publishedCount = await prisma.language.count({
        where: { ownerId: userId, visibility: "PUBLIC" },
    })

    const results = await Promise.all([
        updateBadgeProgress(userId, "first_language", languageCount),
        updateBadgeProgress(userId, "languages_5", languageCount),
        updateBadgeProgress(userId, "languages_10", languageCount),
        updateBadgeProgress(userId, "first_publish", publishedCount),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Check and update progress for dictionary-related badges
 */
export async function checkDictionaryBadges(userId: string) {
    const entryCount = await prisma.dictionaryEntry.count({
        where: {
            language: { ownerId: userId },
        },
    })

    const results = await Promise.all([
        updateBadgeProgress(userId, "dictionary_50", entryCount),
        updateBadgeProgress(userId, "dictionary_100", entryCount),
        updateBadgeProgress(userId, "dictionary_500", entryCount),
        updateBadgeProgress(userId, "dictionary_1000", entryCount),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Check and update progress for script/alphabet badges
 */
export async function checkScriptBadges(userId: string, languageId?: string) {
    // Total symbols across all languages
    const totalSymbols = await prisma.scriptSymbol.count({
        where: {
            language: { ownerId: userId },
        },
    })

    // Check for complete alphabet in a specific language
    let maxSymbolsInLanguage = 0
    if (languageId) {
        maxSymbolsInLanguage = await prisma.scriptSymbol.count({
            where: { languageId },
        })
    }

    const results = await Promise.all([
        updateBadgeProgress(userId, "alphabet_complete", maxSymbolsInLanguage),
        updateBadgeProgress(userId, "script_50", totalSymbols),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Check and update progress for grammar-related badges
 */
export async function checkGrammarBadges(userId: string) {
    const pageCount = await prisma.grammarPage.count({
        where: {
            language: { ownerId: userId },
        },
    })

    const paradigmCount = await prisma.paradigm.count({
        where: {
            language: { ownerId: userId },
        },
    })

    const results = await Promise.all([
        updateBadgeProgress(userId, "grammar_10", pageCount),
        updateBadgeProgress(userId, "grammar_50", pageCount),
        updateBadgeProgress(userId, "paradigm_10", paradigmCount),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Check and update progress for social badges (followers)
 */
export async function checkFollowerBadges(userId: string) {
    const followerCount = await prisma.follow.count({
        where: { followingId: userId },
    })

    const results = await Promise.all([
        updateBadgeProgress(userId, "followers_10", followerCount),
        updateBadgeProgress(userId, "followers_50", followerCount),
        updateBadgeProgress(userId, "followers_100", followerCount),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Check and update progress for favorite badges
 */
export async function checkFavoriteBadges(userId: string) {
    const favoriteCount = await prisma.favorite.count({
        where: {
            language: { ownerId: userId },
        },
    })

    const results = await Promise.all([
        updateBadgeProgress(userId, "favorites_10", favoriteCount),
        updateBadgeProgress(userId, "favorites_50", favoriteCount),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Check and update progress for content badges (articles/texts)
 */
export async function checkContentBadges(userId: string) {
    const articleCount = await prisma.article.count({
        where: { authorId: userId, published: true },
    })

    const textCount = await prisma.text.count({
        where: { authorId: userId },
    })

    const results = await Promise.all([
        updateBadgeProgress(userId, "article_5", articleCount),
        updateBadgeProgress(userId, "article_20", articleCount),
        updateBadgeProgress(userId, "text_10", textCount),
        updateBadgeProgress(userId, "text_25", textCount),
    ])

    return results.filter((r) => r.awarded)
}

/**
 * Get recently earned badges for notification display
 */
/**
 * Get recently earned badges for notification display
 */
export async function getRecentAchievements(userId?: string, hoursAgo = 24) {
    const targetUserId = userId || (await getUserId())

    if (!targetUserId) {
        return []
    }

    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)

    const recentBadges = await prisma.userBadge.findMany({
        where: {
            userId: targetUserId,
            earnedAt: {
                gte: since,
            },
        },
        include: {
            badge: true,
        },
        orderBy: {
            earnedAt: "desc",
        },
    })

    return recentBadges.map((ub) => ({
        ...ub.badge,
        earnedAt: ub.earnedAt!, // We know it's not null because of the query
    }))
}
