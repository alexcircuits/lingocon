// Friend-streak persistence over the pure logic in lib/friend-streak.ts.

import { prisma } from "@/lib/prisma"
import { advanceFriendStreak, displayFriendStreak } from "@/lib/friend-streak"

/** Canonical pair ordering so a streak is unique regardless of who triggers it. */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Users who both follow, and are followed by, `userId`. */
export async function getMutualFriendIds(userId: string): Promise<string[]> {
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
  ])
  const followingSet = new Set(following.map((f) => f.followingId))
  return followers.map((f) => f.followerId).filter((id) => followingSet.has(id))
}

/**
 * Fire-and-forget after a user studies: advance the shared streak with each
 * mutual friend who has also studied today. Idempotent within a day.
 */
export async function recordStudyForFriendStreaks(userId: string, now: Date = new Date()): Promise<void> {
  const friends = await getMutualFriendIds(userId)
  if (friends.length === 0) return

  const dayStart = startOfUtcDay(now)
  const studiedRows = await prisma.xPEvent.findMany({
    where: { userId: { in: friends }, createdAt: { gte: dayStart } },
    distinct: ["userId"],
    select: { userId: true },
  })

  for (const { userId: friendId } of studiedRows) {
    const [userAId, userBId] = orderedPair(userId, friendId)
    const existing = await prisma.friendStreak.findUnique({ where: { userAId_userBId: { userAId, userBId } } })
    const state = {
      current: existing?.current ?? 0,
      longest: existing?.longest ?? 0,
      lastBothDay: existing?.lastBothDay ?? null,
    }
    const next = advanceFriendStreak(state, now)

    // No-op if already counted today (advance returned the same state).
    if (existing && next.lastBothDay?.getTime() === existing.lastBothDay?.getTime() && next.current === existing.current) {
      continue
    }

    await prisma.friendStreak.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: { current: next.current, longest: next.longest, lastBothDay: next.lastBothDay },
      create: { userAId, userBId, current: next.current, longest: next.longest, lastBothDay: next.lastBothDay },
    })
  }
}

export interface FriendStreakView {
  friendId: string
  name: string | null
  image: string | null
  streak: number
  longest: number
}

/** Active friend streaks for a user (stale ones read as 0 and are dropped). */
export async function getFriendStreaks(userId: string, now: Date = new Date()): Promise<FriendStreakView[]> {
  const rows = await prisma.friendStreak.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, image: true } },
      userB: { select: { id: true, name: true, image: true } },
    },
  })

  return rows
    .map((r) => {
      const friend = r.userAId === userId ? r.userB : r.userA
      return {
        friendId: friend.id,
        name: friend.name,
        image: friend.image,
        streak: displayFriendStreak({ current: r.current, longest: r.longest, lastBothDay: r.lastBothDay }, now),
        longest: r.longest,
      }
    })
    .filter((v) => v.streak > 0)
    .sort((a, b) => b.streak - a.streak)
}
