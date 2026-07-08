import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { notFound, redirect } from "next/navigation"
import { StudySession } from "./study-session"
import { syncNewVocabCards } from "@/app/actions/learn"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpen, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

/** Clamp a query-param number to [min, max], falling back to `def`. */
function clampParam(value: string | undefined, def: number, min: number, max: number): number {
  const n = value !== undefined ? parseInt(value, 10) : NaN
  return isNaN(n) ? def : Math.max(min, Math.min(max, n))
}

async function getStudyData(
  slug: string,
  userId: string,
  reviewLimit: number,
  newLimit: number,
) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, visibility: true },
  })

  if (!language || language.visibility === "PRIVATE") return null

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId: language.id } },
  })

  if (!enrollment) return { language, enrollment: null, cards: [], totalDue: 0 }

  const now = new Date()
  const cardSelect = {
    id: true, cardType: true, front: true, back: true, state: true, reps: true,
  } as const

  const [dueCards, newCards, totalDue] = await Promise.all([
    prisma.studyCard.findMany({
      where: {
        enrollmentId: enrollment.id,
        state: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
        due: { lte: now },
      },
      select: cardSelect,
      orderBy: { due: "asc" },
      take: reviewLimit,
    }),
    prisma.studyCard.findMany({
      where: { enrollmentId: enrollment.id, state: "NEW" },
      select: cardSelect,
      orderBy: { createdAt: "asc" },
      take: newLimit,
    }),
    prisma.studyCard.count({
      where: {
        enrollmentId: enrollment.id,
        due: { lte: now },
        state: { not: "NEW" },
      },
    }),
  ])

  return {
    language,
    enrollment,
    cards: [...dueCards, ...newCards],
    totalDue: totalDue + newCards.length,
  }
}

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ new?: string; review?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams

  const reviewLimit = clampParam(sp.review, 14, 1, 50)
  const newLimit    = clampParam(sp.new,     6, 0, 50)

  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"

  if (!session?.user?.id && !isDevMode) {
    redirect(`/login?callbackUrl=/learn/${slug}/study`)
  }

  const userId = session?.user?.id || (await getDevUserId())

  // Sync any vocabulary added to the language after this user enrolled
  // (fire-and-forget pattern — don't block the page on failures)
  const data = await getStudyData(slug, userId, reviewLimit, newLimit)
  if (!data) notFound()

  const { language, enrollment, cards, totalDue } = data

  if (!enrollment) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mx-auto">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Not enrolled yet</h1>
        <p className="text-muted-foreground mb-6">
          Enroll in {language.name} to start your study sessions.
        </p>
        <Button asChild>
          <Link href={`/learn/${slug}`}>Go to Language</Link>
        </Button>
      </div>
    )
  }

  // Run incremental sync in the background — new cards show up next session
  void syncNewVocabCards(language.id).catch(() => {})

  if (cards.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mx-auto">
          <Sparkles className="h-10 w-10 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">All caught up!</h1>
        <p className="text-muted-foreground mb-6">
          No cards due right now. Come back later as new reviews become available.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href={`/learn/${slug}/practice`}>Practice weak words</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/learn/${slug}`}>Back to {language.name}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/learn/${slug}/progress`}>View Progress</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <StudySession
        cards={cards}
        languageId={language.id}
        languageSlug={slug}
        languageName={language.name}
        totalDue={totalDue}
        reviewLimit={reviewLimit}
        newLimit={newLimit}
      />
    </div>
  )
}
