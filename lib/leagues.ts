// Pure leagues logic: tiers, cohort bracketing, and weekly promotion/demotion.
// No DB — so the correctness-critical part is fully unit-tested and the DB
// service and rollover job just orchestrate it.

export const LEAGUE_TIERS = [
  "Bronze",
  "Silver",
  "Gold",
  "Sapphire",
  "Ruby",
  "Diamond",
] as const

export type LeagueTier = (typeof LEAGUE_TIERS)[number]

/** Max learners per bracket. */
export const COHORT_SIZE = 30
/** Top N of a bracket promote to the next tier. */
export const PROMOTE_COUNT = 7
/** Bottom N of a bracket demote to the previous tier (except the lowest tier). */
export const DEMOTE_COUNT = 7

export function tierIndex(tier: LeagueTier): number {
  return LEAGUE_TIERS.indexOf(tier)
}

export function isTopTier(tier: LeagueTier): boolean {
  return tierIndex(tier) === LEAGUE_TIERS.length - 1
}

export function isBottomTier(tier: LeagueTier): boolean {
  return tierIndex(tier) === 0
}

export function promotedTier(tier: LeagueTier): LeagueTier {
  return LEAGUE_TIERS[Math.min(tierIndex(tier) + 1, LEAGUE_TIERS.length - 1)]
}

export function demotedTier(tier: LeagueTier): LeagueTier {
  return LEAGUE_TIERS[Math.max(tierIndex(tier) - 1, 0)]
}

export function isLeagueTier(value: string): value is LeagueTier {
  return (LEAGUE_TIERS as readonly string[]).includes(value)
}

/** Split members into brackets of at most `size` (order preserved). */
export function assignCohorts<T>(members: T[], size: number = COHORT_SIZE): T[][] {
  const cohorts: T[][] = []
  for (let i = 0; i < members.length; i += size) {
    cohorts.push(members.slice(i, i + size))
  }
  return cohorts
}

export interface Standing {
  userId: string
  weeklyXp: number
}

export type RolloverOutcome = "promote" | "demote" | "stay"

export interface RankedStanding extends Standing {
  rank: number // 1-based
}

export interface RolloverResult extends RankedStanding {
  outcome: RolloverOutcome
  nextTier: LeagueTier
}

/** Rank a bracket's standings by weekly XP, highest first (stable for ties). */
export function rankStandings(standings: Standing[]): RankedStanding[] {
  return [...standings]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.weeklyXp - a.s.weeklyXp || a.i - b.i)
    .map(({ s }, idx) => ({ ...s, rank: idx + 1 }))
}

/**
 * Decide each member's fate at week end. Top PROMOTE_COUNT with any XP promote
 * (unless already at the top tier); the bottom DEMOTE_COUNT — and anyone who
 * earned zero XP — demote (unless at the bottom tier). Promotion wins when the
 * two zones overlap in a tiny bracket.
 */
export function computeRollover(standings: Standing[], tier: LeagueTier): RolloverResult[] {
  const ranked = rankStandings(standings)
  const n = ranked.length
  const top = isTopTier(tier)
  const bottom = isBottomTier(tier)

  return ranked.map((entry, i) => {
    let outcome: RolloverOutcome = "stay"
    if (!top && i < PROMOTE_COUNT && entry.weeklyXp > 0) {
      outcome = "promote"
      // Rank-based demotion only kicks in once a bracket is bigger than the
      // promotion zone; below that, only inactive (zero-XP) members demote, so
      // small early-stage brackets don't punish everyone.
    } else if (!bottom && (entry.weeklyXp === 0 || (n > PROMOTE_COUNT && i >= n - DEMOTE_COUNT))) {
      outcome = "demote"
    }
    const nextTier =
      outcome === "promote" ? promotedTier(tier) : outcome === "demote" ? demotedTier(tier) : tier
    return { ...entry, outcome, nextTier }
  })
}
