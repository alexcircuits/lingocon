import { auth } from "@/auth"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Target, CheckCircle2 } from "lucide-react"
import { getQuestBoard } from "@/lib/services/quest-service"
import type { QuestProgress } from "@/lib/quests"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function QuestsPage() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  if (!session?.user?.id && !isDevMode) {
    redirect(`/login?callbackUrl=/learn/quests`)
  }
  const userId = session?.user?.id || (await getDevUserId())

  const board = await getQuestBoard(userId)
  const daily = board.filter((q) => q.quest.period === "daily")
  const monthly = board.filter((q) => q.quest.period === "monthly")
  const doneCount = board.filter((q) => q.complete).length

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Target className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Quests</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          {doneCount} of {board.length} complete. Progress updates as you study.
        </p>
      </div>

      <QuestSection title="Daily" subtitle="Resets at midnight UTC" quests={daily} />
      <QuestSection title="Monthly" subtitle="Resets on the 1st" quests={monthly} className="mt-8" />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/learn/leagues">Your league</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/learn">Back to learning</Link>
        </Button>
      </div>
    </div>
  )
}

function QuestSection({
  title, subtitle, quests, className,
}: {
  title: string
  subtitle: string
  quests: QuestProgress[]
  className?: string
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="space-y-3">
        {quests.map((q) => (
          <div
            key={q.quest.id}
            className={cn("rounded-xl border p-4", q.complete && "border-emerald-500/50 bg-emerald-500/5")}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium flex items-center gap-1.5">
                  {q.complete && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {q.quest.title}
                </p>
                <p className="text-sm text-muted-foreground">{q.quest.description}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0">
                {Math.min(q.current, q.quest.target)}/{q.quest.target}
              </span>
            </div>
            <Progress value={q.pct} className="mt-3 h-2" />
          </div>
        ))}
      </div>
    </section>
  )
}
