import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Sparkles, TrendingDown, RotateCcw } from "lucide-react"
import { StudySession } from "../study/study-session"
import { getPracticeCards, getPracticeCounts, type PracticeMode } from "@/lib/services/practice"

export const dynamic = "force-dynamic"

const PRACTICE_LIMIT = 20

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { slug } = await params
  const { mode } = await searchParams

  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  if (!session?.user?.id && !isDevMode) {
    redirect(`/login?callbackUrl=/learn/${slug}/practice`)
  }
  const userId = session?.user?.id || (await getDevUserId())

  const language = await prisma.language.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, visibility: true },
  })
  if (!language || language.visibility === "PRIVATE") notFound()

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId: language.id } },
  })

  if (!enrollment) {
    return (
      <EmptyPractice
        slug={slug}
        icon={<BookOpen className="h-10 w-10 text-primary" />}
        title="Not enrolled yet"
        body={`Enroll in ${language.name} to unlock practice.`}
      />
    )
  }

  // ── Active practice session for a chosen mode ──
  if (mode === "weak" || mode === "mistakes") {
    const cards = await getPracticeCards(enrollment.id, mode as PracticeMode, PRACTICE_LIMIT)
    if (cards.length === 0) {
      return (
        <EmptyPractice
          slug={slug}
          icon={<Sparkles className="h-10 w-10 text-emerald-500" />}
          title={mode === "weak" ? "No words to drill yet" : "No recent mistakes"}
          body={
            mode === "weak"
              ? "Study some lessons first, then come back to drill your weakest words."
              : "You haven't missed any cards recently. Nice work!"
          }
        />
      )
    }
    return (
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <StudySession
          cards={cards}
          languageId={language.id}
          languageSlug={slug}
          languageName={language.name}
          totalDue={cards.length}
          reviewLimit={cards.length}
          newLimit={0}
        />
      </div>
    )
  }

  // ── Hub landing ──
  const counts = await getPracticeCounts(enrollment.id)
  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
        <p className="text-muted-foreground mt-1">
          Extra sessions to shore up {language.name} — no waiting for reviews to come due.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PracticeModeCard
          href={`/learn/${slug}/practice?mode=weak`}
          icon={<TrendingDown className="h-6 w-6 text-amber-500" />}
          title="Weak words"
          description="Drill the words your memory is least sure of (lowest stability first)."
          count={counts.weak}
          noun="learned word"
        />
        <PracticeModeCard
          href={`/learn/${slug}/practice?mode=mistakes`}
          icon={<RotateCcw className="h-6 w-6 text-rose-500" />}
          title="Redo mistakes"
          description="Re-attempt the cards you answered wrong in the last three weeks."
          count={counts.mistakes}
          noun="recent mistake"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/learn/leagues">View your league</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/learn/${slug}`}>Back to {language.name}</Link>
        </Button>
      </div>
    </div>
  )
}

function PracticeModeCard({
  href, icon, title, description, count, noun,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  count: number
  noun: string
}) {
  const disabled = count === 0
  const label = `${count} ${noun}${count === 1 ? "" : "s"}`
  return (
    <Card className={disabled ? "opacity-60" : "transition-shadow hover:shadow-md"}>
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">{icon}</div>
          <div>
            <h2 className="font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground flex-1">{description}</p>
        <Button asChild className="mt-4 w-full" disabled={disabled}>
          {disabled ? <span>Nothing to practice</span> : <Link href={href}>Start</Link>}
        </Button>
      </CardContent>
    </Card>
  )
}

function EmptyPractice({
  slug, icon, title, body,
}: {
  slug: string
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted mx-auto">
        {icon}
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{body}</p>
      <div className="flex flex-col gap-3">
        <Button asChild>
          <Link href={`/learn/${slug}/practice`}>Practice hub</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/learn/${slug}`}>Back to language</Link>
        </Button>
      </div>
    </div>
  )
}
