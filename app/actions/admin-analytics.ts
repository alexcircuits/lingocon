"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { subDays, startOfDay, format } from "date-fns"

/**
 * Get platform overview statistics
 */
export async function getPlatformOverview() {
    await requireAdmin()

    const [
        totalUsers,
        totalLanguages,
        publicLanguages,
        totalEntries,
        totalGrammarPages,
        totalParadigms,
        totalArticles,
        totalTexts,
        totalActivities
    ] = await Promise.all([
        prisma.user.count(),
        prisma.language.count(),
        prisma.language.count({ where: { visibility: "PUBLIC" } }),
        prisma.dictionaryEntry.count(),
        prisma.grammarPage.count(),
        prisma.paradigm.count(),
        prisma.article.count(),
        prisma.text.count(),
        prisma.activity.count()
    ])

    // Get counts from 7 days ago for growth comparison
    const sevenDaysAgo = subDays(new Date(), 7)
    const [
        usersLastWeek,
        languagesLastWeek,
        entriesLastWeek
    ] = await Promise.all([
        prisma.user.count({ where: { createdAt: { lt: sevenDaysAgo } } }),
        prisma.language.count({ where: { createdAt: { lt: sevenDaysAgo } } }),
        prisma.dictionaryEntry.count({ where: { createdAt: { lt: sevenDaysAgo } } })
    ])

    return {
        totalUsers,
        totalLanguages,
        publicLanguages,
        privateLanguages: totalLanguages - publicLanguages,
        totalEntries,
        totalGrammarPages,
        totalParadigms,
        totalArticles,
        totalTexts,
        totalActivities,
        growth: {
            users: totalUsers - usersLastWeek,
            languages: totalLanguages - languagesLastWeek,
            entries: totalEntries - entriesLastWeek
        }
    }
}

/**
 * Get user signups over time
 */
export async function getUserGrowth(days: number = 30) {
    await requireAdmin()

    const startDate = startOfDay(subDays(new Date(), days))

    const users = await prisma.user.findMany({
        where: {
            createdAt: { gte: startDate }
        },
        select: {
            createdAt: true
        },
        orderBy: {
            createdAt: "asc"
        }
    })

    // Group by date
    const dateMap = new Map<string, number>()

    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd")
        dateMap.set(date, 0)
    }

    // Count users per day
    users.forEach(user => {
        const date = format(user.createdAt, "yyyy-MM-dd")
        if (dateMap.has(date)) {
            dateMap.set(date, dateMap.get(date)! + 1)
        }
    })

    // Convert to array for charts
    return Array.from(dateMap.entries()).map(([date, count]) => ({
        date: format(new Date(date), "MMM d"),
        fullDate: date,
        signups: count
    }))
}

/**
 * Get content creation over time
 */
export async function getContentGrowth(days: number = 30) {
    await requireAdmin()

    const startDate = startOfDay(subDays(new Date(), days))

    const [languages, entries] = await Promise.all([
        prisma.language.findMany({
            where: { createdAt: { gte: startDate } },
            select: { createdAt: true }
        }),
        prisma.dictionaryEntry.findMany({
            where: { createdAt: { gte: startDate } },
            select: { createdAt: true }
        })
    ])

    // Group by date
    const dateMap = new Map<string, { languages: number; entries: number }>()

    for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd")
        dateMap.set(date, { languages: 0, entries: 0 })
    }

    languages.forEach(lang => {
        const date = format(lang.createdAt, "yyyy-MM-dd")
        if (dateMap.has(date)) {
            const current = dateMap.get(date)!
            dateMap.set(date, { ...current, languages: current.languages + 1 })
        }
    })

    entries.forEach(entry => {
        const date = format(entry.createdAt, "yyyy-MM-dd")
        if (dateMap.has(date)) {
            const current = dateMap.get(date)!
            dateMap.set(date, { ...current, entries: current.entries + 1 })
        }
    })

    return Array.from(dateMap.entries()).map(([date, counts]) => ({
        date: format(new Date(date), "MMM d"),
        fullDate: date,
        ...counts
    }))
}

/**
 * Get top languages by size or favorites
 */
export async function getTopLanguages(limit: number = 10) {
    await requireAdmin()

    const languages = await prisma.language.findMany({
        include: {
            owner: {
                select: { name: true, email: true }
            },
            _count: {
                select: {
                    dictionaryEntries: true,
                    grammarPages: true,
                    favorites: true,
                    scriptSymbols: true
                }
            }
        },
        orderBy: {
            favorites: {
                _count: "desc"
            }
        },
        take: limit
    })

    return languages.map(lang => ({
        id: lang.id,
        name: lang.name,
        slug: lang.slug,
        visibility: lang.visibility,
        owner: lang.owner.name || lang.owner.email,
        entries: lang._count.dictionaryEntries,
        grammarPages: lang._count.grammarPages,
        favorites: lang._count.favorites,
        symbols: lang._count.scriptSymbols,
        createdAt: lang.createdAt
    }))
}

/**
 * Get activity breakdown by type
 */
export async function getActivityBreakdown(days: number = 30) {
    await requireAdmin()

    const startDate = startOfDay(subDays(new Date(), days))

    const activities = await prisma.activity.groupBy({
        by: ["type", "entityType"],
        where: {
            createdAt: { gte: startDate }
        },
        _count: {
            id: true
        }
    })

    // Group by entity type
    const byEntityType: Record<string, number> = {}
    const byActionType: Record<string, number> = {}

    activities.forEach(activity => {
        // By entity
        if (!byEntityType[activity.entityType]) {
            byEntityType[activity.entityType] = 0
        }
        byEntityType[activity.entityType] += activity._count.id

        // By action
        if (!byActionType[activity.type]) {
            byActionType[activity.type] = 0
        }
        byActionType[activity.type] += activity._count.id
    })

    return {
        byEntityType: Object.entries(byEntityType).map(([name, value]) => ({
            name: name.replace(/_/g, " ").toLowerCase(),
            value
        })),
        byActionType: Object.entries(byActionType).map(([name, value]) => ({
            name: name.toLowerCase(),
            value
        }))
    }
}

/**
 * Get most active users
 */
export async function getMostActiveUsers(limit: number = 10) {
    await requireAdmin()

    const users = await prisma.user.findMany({
        include: {
            _count: {
                select: {
                    languages: true,
                    activities: true,
                    articles: true,
                    texts: true
                }
            }
        },
        orderBy: {
            activities: {
                _count: "desc"
            }
        },
        take: limit
    })

    return users.map(user => ({
        id: user.id,
        name: user.name || "Unknown",
        email: user.email,
        image: user.image,
        isAdmin: user.isAdmin,
        languages: user._count.languages,
        activities: user._count.activities,
        articles: user._count.articles,
        texts: user._count.texts,
        createdAt: user.createdAt
    }))
}

/**
 * Get recent signups
 */
export async function getRecentSignups(limit: number = 5) {
    await requireAdmin()

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
            _count: {
                select: {
                    languages: true
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        },
        take: limit
    })

    return users.map(user => ({
        id: user.id,
        name: user.name || "Unknown",
        email: user.email,
        image: user.image,
        languages: user._count.languages,
        createdAt: user.createdAt
    }))
}

/**
 * Get all users with pagination and search
 */
export async function getAllUsers(params: {
    page?: number
    limit?: number
    search?: string
} = {}) {
    await requireAdmin()

    const { page = 1, limit = 20, search = "" } = params

    const where = search ? {
        OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } }
        ]
    } : {}

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            include: {
                _count: {
                    select: {
                        languages: true,
                        activities: true,
                        articles: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.user.count({ where })
    ])

    return {
        users: users.map(user => ({
            id: user.id,
            name: user.name || "Unknown",
            email: user.email,
            image: user.image,
            isAdmin: user.isAdmin,
            languages: user._count.languages,
            activities: user._count.activities,
            articles: user._count.articles,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        })),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    }
}

/**
 * Get all languages for admin overview
 */
export async function getAllLanguages(params: {
    page?: number
    limit?: number
    visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE" | "ALL"
} = {}) {
    await requireAdmin()

    const { page = 1, limit = 20, visibility = "ALL" } = params

    const where = visibility !== "ALL" ? { visibility } : {}

    const [languages, total] = await Promise.all([
        prisma.language.findMany({
            where,
            include: {
                owner: { select: { name: true, email: true } },
                _count: {
                    select: {
                        dictionaryEntries: true,
                        grammarPages: true,
                        scriptSymbols: true,
                        favorites: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.language.count({ where })
    ])

    return {
        languages: languages.map(lang => ({
            id: lang.id,
            name: lang.name,
            slug: lang.slug,
            visibility: lang.visibility,
            owner: lang.owner.name || lang.owner.email,
            entries: lang._count.dictionaryEntries,
            grammarPages: lang._count.grammarPages,
            symbols: lang._count.scriptSymbols,
            favorites: lang._count.favorites,
            createdAt: lang.createdAt,
            updatedAt: lang.updatedAt
        })),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    }
}

/**
 * Get detailed user info
 */
export async function getUserDetails(userId: string) {
    await requireAdmin()

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            languages: {
                orderBy: { createdAt: "desc" },
                include: {
                    _count: {
                        select: {
                            dictionaryEntries: true,
                            grammarPages: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    activities: true,
                    articles: true,
                    texts: true,
                    favorites: true
                }
            }
        }
    })

    if (!user) return null

    return {
        ...user,
        languages: user.languages.map(lang => ({
            id: lang.id,
            name: lang.name,
            slug: lang.slug,
            visibility: lang.visibility,
            entries: lang._count.dictionaryEntries,
            grammarPages: lang._count.grammarPages,
            createdAt: lang.createdAt
        }))
    }
}

/**
 * Get detailed language info for admin
 */
export async function getLanguageDetails(languageId: string) {
    await requireAdmin()

    const language = await prisma.language.findUnique({
        where: { id: languageId },
        include: {
            owner: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true
                }
            },
            collaborators: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    dictionaryEntries: true,
                    grammarPages: true,
                    scriptSymbols: true,
                    paradigms: true,
                    articles: true,
                    texts: true,
                    favorites: true,
                    activities: true
                }
            }
        }
    })

    if (!language) return null

    // Get recent activity for this language
    const recentActivity = await prisma.activity.findMany({
        where: { languageId },
        include: {
            user: {
                select: { name: true, email: true }
            }
        },
        orderBy: { createdAt: "desc" },
        take: 10
    })

    return {
        ...language,
        stats: language._count,
        recentActivity: recentActivity.map(a => ({
            id: a.id,
            type: a.type,
            entityType: a.entityType,
            description: a.description,
            user: a.user.name || a.user.email,
            createdAt: a.createdAt
        }))
    }
}

