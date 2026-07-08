// League orchestration over the pure algorithm in lib/leagues.ts.
// Weekly XP is summed live from XPEvent, so there's no incremental XP tracking
// to keep in sync — a member's rank is always derived from the source of truth.

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { startOfWeekUtc } from "@/lib/leaderboard"
import {
  assignCohorts,
  computeRollover,
  rankStandings,
  COHORT_SIZE,
  type LeagueTier,
  type RankedStanding,
} from "@/lib/leagues"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const STARTING_TIER: LeagueTier = "Bronze"

// Arbitrary fixed key so concurrent rollover runs serialize on the same
// transaction-scoped Postgres advisory lock.
const LEAGUE_ROLLOVER_LOCK = 4267123

type Db = Pick<Prisma.TransactionClient, "xPEvent">

/** Sum each user's XP in [since, until). Runs on the given client (prisma or a tx). */
async function weeklyXp(
  db: Db,
  userIds: string[],
  since: Date,
  until: Date,
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const rows = await db.xPEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, createdAt: { gte: since, lt: until } },
    _sum: { amount: true },
  })
  return new Map(rows.map((r) => [r.userId, r._sum.amount ?? 0]))
}

/**
 * Ensure the user has a bracket for the current week, returning its id. Members
 * placed by the rollover job already have one; this only seeds newcomers into a
 * Bronze bracket with a free slot (creating one when all are full).
 */
export async function joinCurrentLeague(userId: string): Promise<string> {
  const weekStart = startOfWeekUtc(new Date())

  const existing = await prisma.leagueMember.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    select: { leagueId: true },
  })
  if (existing) return existing.leagueId

  // Find a Bronze bracket this week that still has room.
  const bronze = await prisma.league.findMany({
    where: { tier: STARTING_TIER, weekStart },
    select: { id: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  })
  const openLeague = bronze.find((l) => l._count.members < COHORT_SIZE)

  const leagueId =
    openLeague?.id ??
    (await prisma.league.create({ data: { tier: STARTING_TIER, weekStart } })).id

  try {
    await prisma.leagueMember.create({ data: { leagueId, userId, weekStart } })
    return leagueId
  } catch {
    // Lost a race on the (userId, weekStart) unique — re-read the winner.
    const now = await prisma.leagueMember.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      select: { leagueId: true },
    })
    return now?.leagueId ?? leagueId
  }
}

export interface LeagueStandings {
  tier: LeagueTier
  weekStart: Date
  entries: (RankedStanding & { name: string | null; image: string | null })[]
  you: string
}

/** The signed-in user's current bracket, ranked. Joins them if needed. */
export async function getStandings(userId: string): Promise<LeagueStandings> {
  const leagueId = await joinCurrentLeague(userId)
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: { members: { include: { user: { select: { id: true, name: true, image: true } } } } },
  })

  const weekEnd = new Date(league.weekStart.getTime() + WEEK_MS)
  const userIds = league.members.map((m) => m.userId)
  const xp = await weeklyXp(prisma, userIds, league.weekStart, weekEnd)

  const ranked = rankStandings(
    league.members.map((m) => ({ userId: m.userId, weeklyXp: xp.get(m.userId) ?? 0 })),
  )
  const userById = new Map(league.members.map((m) => [m.userId, m.user]))

  return {
    tier: league.tier as LeagueTier,
    weekStart: league.weekStart,
    you: userId,
    entries: ranked.map((r) => ({
      ...r,
      name: userById.get(r.userId)?.name ?? null,
      image: userById.get(r.userId)?.image ?? null,
    })),
  }
}

/**
 * Roll over every finished, unprocessed bracket: rank it, compute promotions/
 * demotions, and seed next week's brackets from the results. Idempotent — a
 * bracket is marked processedAt once handled, and users already placed for the
 * new week are skipped. Safe to run more than once.
 */
export async function runLeagueRollover(now: Date = new Date()): Promise<number> {
  const currentWeek = startOfWeekUtc(now)

  return prisma.$transaction(
    async (tx) => {
      // Serialize concurrent rollover runs (cron double-fire / stale-lease
      // reclaim) so two runs can't both read the same unprocessed brackets and
      // double-seed the new week.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LEAGUE_ROLLOVER_LOCK})`

      const ended = await tx.league.findMany({
        where: { weekStart: { lt: currentWeek }, processedAt: null },
        orderBy: { weekStart: "asc" },
        include: { members: { select: { userId: true } } },
      })
      if (ended.length === 0) return 0

      // Batch weekly XP: one groupBy per distinct week window, not per bracket.
      const weeks = [...new Set(ended.map((l) => l.weekStart.getTime()))].sort((a, b) => a - b)
      const xpByWeek = new Map<number, Map<string, number>>()
      for (const weekMs of weeks) {
        const userIds = ended
          .filter((l) => l.weekStart.getTime() === weekMs)
          .flatMap((l) => l.members.map((m) => m.userId))
        xpByWeek.set(weekMs, await weeklyXp(tx, userIds, new Date(weekMs), new Date(weekMs + WEEK_MS)))
      }

      // Resolve each member's next tier. Iterating in weekStart-asc order means
      // that if a user appears in two unprocessed brackets (a skipped week),
      // the more recent bracket's outcome deterministically wins.
      const nextTierByUser = new Map<string, LeagueTier>()
      for (const league of ended) {
        const xp = xpByWeek.get(league.weekStart.getTime())!
        const standings = league.members.map((m) => ({ userId: m.userId, weeklyXp: xp.get(m.userId) ?? 0 }))
        for (const r of computeRollover(standings, league.tier as LeagueTier)) {
          nextTierByUser.set(r.userId, r.nextTier)
        }
      }

      // Re-read "already assigned this week" INSIDE the tx so a concurrent
      // joinCurrentLeague is accounted for.
      const already = new Set(
        (await tx.leagueMember.findMany({ where: { weekStart: currentWeek }, select: { userId: true } })).map(
          (m) => m.userId,
        ),
      )

      const usersByTier = new Map<LeagueTier, string[]>()
      for (const [userId, tier] of nextTierByUser) {
        if (already.has(userId)) continue
        const list = usersByTier.get(tier) ?? []
        list.push(userId)
        usersByTier.set(tier, list)
      }

      for (const [tier, users] of usersByTier) {
        for (const cohort of assignCohorts(users)) {
          const league = await tx.league.create({ data: { tier, weekStart: currentWeek } })
          // skipDuplicates so a racing join on (userId, weekStart) can't abort
          // the whole rollover — that user simply keeps the bracket they joined.
          await tx.leagueMember.createMany({
            data: cohort.map((userId) => ({ leagueId: league.id, userId, weekStart: currentWeek })),
            skipDuplicates: true,
          })
        }
      }
      await tx.league.updateMany({
        where: { id: { in: ended.map((l) => l.id) } },
        data: { processedAt: now },
      })
      return ended.length
    },
    { timeout: 120_000 },
  )
}
