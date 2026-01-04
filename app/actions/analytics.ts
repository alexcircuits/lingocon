import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function getPosDistribution(languageId: string) {
  const session = await auth()
  if (!session?.user && process.env.DEV_MODE !== "true") {
    return []
  }

  // Group by part of speech
  const distribution = await prisma.dictionaryEntry.groupBy({
    by: ['partOfSpeech'],
    where: {
      languageId,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  })

  // Format for Recharts
  // Handle null/empty POS as "Uncategorized"
  return distribution.map((item) => ({
    name: item.partOfSpeech || "Uncategorized",
    value: item._count.id,
  }))
}

export async function getActivityHistory(languageId: string) {
  const session = await auth()
  if (!session?.user && process.env.DEV_MODE !== "true") {
    return []
  }

  // Get activities for the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const activities = await prisma.activity.findMany({
    where: {
      languageId,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // Group by date
  const activityMap = new Map<string, number>()
  
  // Initialize last 30 days with 0
  for (let i = 0; i < 30; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    activityMap.set(dateStr, 0)
  }

  // Count activities
  activities.forEach((activity) => {
    const dateStr = activity.createdAt.toISOString().split('T')[0]
    if (activityMap.has(dateStr)) {
      activityMap.set(dateStr, activityMap.get(dateStr)! + 1)
    }
  })

  // Convert to array and sort by date
  const history = Array.from(activityMap.entries())
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    // Format date for display (e.g., "Jan 1")
    .map(item => {
      const d = new Date(item.date)
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: item.date,
        count: item.count
      }
    })

  return history
}

export async function getCompletenessStats(languageId: string) {
  const session = await auth()
  if (!session?.user && process.env.DEV_MODE !== "true") {
    return null
  }

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    include: {
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
          paradigms: true,
        }
      }
    }
  })

  if (!language) return null

  // Define goals for "Complete" status (arbitrary but helpful)
  const goals = {
    scriptSymbols: 10, // At least some alphabet
    grammarPages: 5,   // Basic grammar
    dictionaryEntries: 100, // Basic lexicon
    paradigms: 3,      // Basic morphology
  }

  const progress = {
    scriptSymbols: Math.min(100, Math.round((language._count.scriptSymbols / goals.scriptSymbols) * 100)),
    grammarPages: Math.min(100, Math.round((language._count.grammarPages / goals.grammarPages) * 100)),
    dictionaryEntries: Math.min(100, Math.round((language._count.dictionaryEntries / goals.dictionaryEntries) * 100)),
    paradigms: Math.min(100, Math.round((language._count.paradigms / goals.paradigms) * 100)),
  }

  const overall = Math.round(
    (progress.scriptSymbols + progress.grammarPages + progress.dictionaryEntries + progress.paradigms) / 4
  )

  return {
    counts: language._count,
    goals,
    progress,
    overall
  }
}

