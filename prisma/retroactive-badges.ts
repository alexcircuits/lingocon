import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Retroactively award badges to all existing users based on their current stats
 */

async function updateBadgeProgress(
    userId: string,
    badgeKey: string,
    newProgress: number
): Promise<{ awarded: boolean; badgeName: string | null }> {
    const badge = await prisma.badge.findUnique({
        where: { key: badgeKey },
    })

    if (!badge) {
        return { awarded: false, badgeName: null }
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
        return { awarded: false, badgeName: null }
    }

    const shouldAward = newProgress >= badge.threshold

    await prisma.userBadge.upsert({
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
    })

    return {
        awarded: shouldAward,
        badgeName: shouldAward ? `${badge.icon} ${badge.name}` : null,
    }
}

async function checkAllBadgesForUser(userId: string): Promise<string[]> {
    const awarded: string[] = []

    // Language badges
    const languageCount = await prisma.language.count({
        where: { ownerId: userId },
    })
    const publishedCount = await prisma.language.count({
        where: { ownerId: userId, visibility: "PUBLIC" },
    })

    const langResults = await Promise.all([
        updateBadgeProgress(userId, "first_language", languageCount),
        updateBadgeProgress(userId, "languages_5", languageCount),
        updateBadgeProgress(userId, "languages_10", languageCount),
        updateBadgeProgress(userId, "first_publish", publishedCount),
    ])
    awarded.push(...langResults.filter(r => r.awarded).map(r => r.badgeName!))

    // Dictionary badges
    const entryCount = await prisma.dictionaryEntry.count({
        where: { language: { ownerId: userId } },
    })

    const dictResults = await Promise.all([
        updateBadgeProgress(userId, "dictionary_50", entryCount),
        updateBadgeProgress(userId, "dictionary_100", entryCount),
        updateBadgeProgress(userId, "dictionary_500", entryCount),
        updateBadgeProgress(userId, "dictionary_1000", entryCount),
    ])
    awarded.push(...dictResults.filter(r => r.awarded).map(r => r.badgeName!))

    // Script badges
    const totalSymbols = await prisma.scriptSymbol.count({
        where: { language: { ownerId: userId } },
    })

    // Get max symbols in a single language for "complete alphabet"
    const languages = await prisma.language.findMany({
        where: { ownerId: userId },
        select: { id: true },
    })

    let maxSymbolsInLanguage = 0
    for (const lang of languages) {
        const count = await prisma.scriptSymbol.count({
            where: { languageId: lang.id },
        })
        if (count > maxSymbolsInLanguage) maxSymbolsInLanguage = count
    }

    const scriptResults = await Promise.all([
        updateBadgeProgress(userId, "alphabet_complete", maxSymbolsInLanguage),
        updateBadgeProgress(userId, "script_50", totalSymbols),
    ])
    awarded.push(...scriptResults.filter(r => r.awarded).map(r => r.badgeName!))

    // Grammar badges
    const pageCount = await prisma.grammarPage.count({
        where: { language: { ownerId: userId } },
    })
    const paradigmCount = await prisma.paradigm.count({
        where: { language: { ownerId: userId } },
    })

    const grammarResults = await Promise.all([
        updateBadgeProgress(userId, "grammar_10", pageCount),
        updateBadgeProgress(userId, "grammar_50", pageCount),
        updateBadgeProgress(userId, "paradigm_10", paradigmCount),
    ])
    awarded.push(...grammarResults.filter(r => r.awarded).map(r => r.badgeName!))

    // Social badges (followers)
    const followerCount = await prisma.follow.count({
        where: { followingId: userId },
    })

    const followerResults = await Promise.all([
        updateBadgeProgress(userId, "followers_10", followerCount),
        updateBadgeProgress(userId, "followers_50", followerCount),
        updateBadgeProgress(userId, "followers_100", followerCount),
    ])
    awarded.push(...followerResults.filter(r => r.awarded).map(r => r.badgeName!))

    // Favorite badges
    const favoriteCount = await prisma.favorite.count({
        where: { language: { ownerId: userId } },
    })

    const favResults = await Promise.all([
        updateBadgeProgress(userId, "favorites_10", favoriteCount),
        updateBadgeProgress(userId, "favorites_50", favoriteCount),
    ])
    awarded.push(...favResults.filter(r => r.awarded).map(r => r.badgeName!))

    // Content badges
    const articleCount = await prisma.article.count({
        where: { authorId: userId, published: true },
    })
    const textCount = await prisma.text.count({
        where: { authorId: userId },
    })

    const contentResults = await Promise.all([
        updateBadgeProgress(userId, "article_5", articleCount),
        updateBadgeProgress(userId, "article_20", articleCount),
        updateBadgeProgress(userId, "text_10", textCount),
        updateBadgeProgress(userId, "text_25", textCount),
    ])
    awarded.push(...contentResults.filter(r => r.awarded).map(r => r.badgeName!))

    return awarded
}

async function retroactivelyAwardBadges() {
    console.log("🏅 Retroactively awarding badges to all users...\n")

    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true },
    })

    console.log(`Found ${users.length} users to process\n`)

    let totalAwarded = 0

    for (const user of users) {
        const displayName = user.name || user.email || user.id
        const awarded = await checkAllBadgesForUser(user.id)

        if (awarded.length > 0) {
            console.log(`✅ ${displayName}:`)
            for (const badge of awarded) {
                console.log(`   ${badge}`)
            }
            totalAwarded += awarded.length
        } else {
            console.log(`⏭️  ${displayName}: No new badges`)
        }
    }

    console.log(`\n🏆 Done! Awarded ${totalAwarded} badges to ${users.length} users.`)
}

retroactivelyAwardBadges()
    .catch((e) => {
        console.error("Error:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
