import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Trophy, Crown, ArrowLeft, GraduationCap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getUserId } from "@/lib/auth-helpers"
import { getWeeklyLeaderboard } from "@/app/actions/leaderboard"

export async function generateMetadata() {
  const t = await getTranslations("leaderboard")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export const dynamic = "force-dynamic"

const RANK_ACCENT: Record<number, string> = {
  1: "text-amber-500",
  2: "text-slate-400",
  3: "text-amber-700",
}

export default async function LeaderboardPage() {
  const t = await getTranslations("leaderboard")
  const [{ entries, me }, meId] = await Promise.all([
    getWeeklyLeaderboard(20),
    getUserId(),
  ])

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1 text-muted-foreground">
        <Link href="/learn">
          <ArrowLeft className="h-4 w-4" />
          {t("navLabel")}
        </Link>
      </Button>

      <div className="relative mb-8 overflow-hidden rounded-3xl border border-border/50 bg-card/50 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t("eyebrow")}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>

        {me && (
          <div className="relative mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm">
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">{t("yourRank")}:</span>
            <span className="font-semibold">#{me.rank}</span>
            <span className="text-muted-foreground">· {me.xp.toLocaleString()} {t("xp")}</span>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <GraduationCap className="h-7 w-7 text-amber-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{t("emptyTitle")}</h3>
            <p className="max-w-sm text-muted-foreground">{t("emptyDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/40 p-0">
            {entries.map((e) => {
              const isMe = e.userId === meId
              const name = e.name || t("anonymous")
              return (
                <Link
                  key={e.userId}
                  href={`/users/${e.userId}`}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50",
                    isMe && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 text-center text-sm font-bold tabular-nums",
                      RANK_ACCENT[e.rank] ?? "text-muted-foreground",
                    )}
                  >
                    {e.rank}
                  </span>
                  <Avatar className="h-9 w-9 shrink-0">
                    {e.image && <AvatarImage src={e.image} alt="" />}
                    <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-medium">
                    {name}
                    {isMe && <span className="ml-2 text-xs font-normal text-primary">({t("you")})</span>}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {e.xp.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted-foreground">{t("xp")}</span>
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
