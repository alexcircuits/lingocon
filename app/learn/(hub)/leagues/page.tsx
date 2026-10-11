import { auth } from "@/auth"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, ChevronUp, ChevronDown } from "lucide-react"
import { getStandings } from "@/lib/services/league-service"
import { getFriendStreaks } from "@/lib/services/friend-streak-service"
import { PROMOTE_COUNT, DEMOTE_COUNT, isTopTier, isBottomTier, computeRollover } from "@/lib/leagues"
import { Flame } from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const TIER_STYLES: Record<string, string> = {
  Bronze: "text-amber-700",
  Silver: "text-slate-400",
  Gold: "text-yellow-500",
  Sapphire: "text-sky-500",
  Ruby: "text-rose-500",
  Diamond: "text-cyan-400",
}

export default async function LeaguesPage() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  if (!session?.user?.id && !isDevMode) {
    redirect(`/login?callbackUrl=/learn/leagues`)
  }
  const userId = session?.user?.id || (await getDevUserId())

  const [standings, friendStreaks] = await Promise.all([
    getStandings(userId),
    getFriendStreaks(userId),
  ])
  const n = standings.entries.length

  // Derive each row's promote/demote outcome from the SAME function the weekly
  // rollover uses, so the chevrons can never drift from what actually happens
  // (e.g. an inactive 0-XP member in a top rank still shows as a demotion).
  const outcomeByUser = new Map(
    computeRollover(
      standings.entries.map((e) => ({ userId: e.userId, weeklyXp: e.weeklyXp })),
      standings.tier,
    ).map((r) => [r.userId, r.outcome]),
  )
  // For the header copy only.
  const promoteZone = isTopTier(standings.tier) ? 0 : PROMOTE_COUNT
  const demoteZone = isBottomTier(standings.tier) || n <= PROMOTE_COUNT ? 0 : DEMOTE_COUNT

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-6 text-center">
        <Trophy className={cn("h-12 w-12 mx-auto mb-2", TIER_STYLES[standings.tier] ?? "text-primary")} />
        <h1 className="text-3xl font-bold tracking-tight">{standings.tier} League</h1>
        <p className="text-muted-foreground mt-1">
          Top {promoteZone || "—"} promote{demoteZone ? `, bottom ${demoteZone} demote` : ""} when the week
          ends. Earn XP from lessons and reviews to climb.
        </p>
      </div>

      <ol className="rounded-xl border divide-y overflow-hidden">
        {standings.entries.map((e) => {
          const zone = outcomeByUser.get(e.userId) ?? "stay"
          const isYou = e.userId === standings.you
          return (
            <li
              key={e.userId}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                isYou && "bg-primary/5",
                zone === "promote" && "border-l-4 border-l-emerald-500",
                zone === "demote" && "border-l-4 border-l-rose-500",
              )}
            >
              <span className="w-6 text-center font-semibold tabular-nums text-muted-foreground">
                {e.rank}
              </span>
              {zone === "promote" && <ChevronUp className="h-4 w-4 text-emerald-500 shrink-0" />}
              {zone === "demote" && <ChevronDown className="h-4 w-4 text-rose-500 shrink-0" />}
              {zone === "stay" && <span className="w-4 shrink-0" />}
              <Avatar className="h-8 w-8">
                {e.image && <AvatarImage src={e.image} alt={e.name ?? "learner"} />}
                <AvatarFallback>{(e.name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className={cn("flex-1 truncate", isYou && "font-semibold")}>
                {e.name ?? "Anonymous"}
                {isYou && <span className="text-muted-foreground font-normal"> (you)</span>}
              </span>
              <span className="font-semibold tabular-nums">{e.weeklyXp} XP</span>
            </li>
          )
        })}
      </ol>

      {friendStreaks.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Friend streaks
          </h2>
          <ul className="rounded-xl border divide-y overflow-hidden">
            {friendStreaks.map((f) => (
              <li key={f.friendId} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar className="h-8 w-8">
                  {f.image && <AvatarImage src={f.image} alt={f.name ?? "friend"} />}
                  <AvatarFallback>{(f.name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{f.name ?? "Friend"}</span>
                <span className="flex items-center gap-1 font-semibold tabular-nums">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {f.streak}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Shared with mutual follows — keeps growing every day you both study.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/learn/quests">Quests</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/learn">Back to learning</Link>
        </Button>
      </div>
    </div>
  )
}
