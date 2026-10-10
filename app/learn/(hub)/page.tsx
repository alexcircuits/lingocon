import { auth } from "@/auth"
import { getDevUserId } from "@/lib/dev-auth"
import { prisma } from "@/lib/prisma"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Flame, Sparkles, Trophy, GraduationCap, ArrowRight, Globe, Compass, Target, CheckCircle2 } from "lucide-react"
import { xpToNextLevel, DAILY_XP_GOAL } from "@/lib/fsrs"
import { getLearnableLanguages } from "@/lib/learn-catalog"
import { LearnLanguageCard } from "./components/learn-language-card"
import { cn } from "@/lib/utils"
import { getTranslations } from "next-intl/server"

export async function generateMetadata() {
  const t = await getTranslations("learn.dashboard")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export const dynamic = "force-dynamic"

async function getLearnDashboardData(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      language: { select: { id: true, name: true, slug: true, flagUrl: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { lastStudied: "desc" },
  })

  const now = new Date()
  const dueCounts = enrollments.length
    ? await prisma.studyCard.groupBy({
        by: ["enrollmentId"],
        where: { enrollmentId: { in: enrollments.map((e) => e.id) }, due: { lte: now } },
        _count: true,
      })
    : []
  const dueByEnrollment = new Map(dueCounts.map((d) => [d.enrollmentId, d._count]))

  return enrollments.map((e) => ({
    ...e,
    dueCount: dueByEnrollment.get(e.id) ?? 0,
    levelInfo: xpToNextLevel(e.xp),
  }))
}

/** Total XP the user has earned today (UTC), for the daily-goal ring. */
async function getTodayXp(userId: string): Promise<number> {
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const result = await prisma.xPEvent.aggregate({
    where: { userId, createdAt: { gte: startOfToday } },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

export default async function LearnDashboardPage() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  const userId = session?.user?.id || (isDevMode ? await getDevUserId() : null)
  const t = await getTranslations("learn.dashboard")
  const tl = await getTranslations("leaderboard")

  const enrollments = userId ? await getLearnDashboardData(userId) : []
  const todayXp = userId ? await getTodayXp(userId) : 0
  const enrolledIds = enrollments.map((e) => e.language.id)

  // Discovery: learnable languages the user isn't already enrolled in.
  const discover = await getLearnableLanguages({ take: 6, excludeLanguageIds: enrolledIds })

  const totalXP = enrollments.reduce((s, e) => s + e.xp, 0)
  const totalStreak = Math.max(...enrollments.map((e) => e.streak), 0)
  const totalDue = enrollments.reduce((s, e) => s + e.dueCount, 0)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-border/50 bg-card/50 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-primary">{userId ? t("myLearningEyebrow") : t("learnEyebrow")}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {userId ? t("headingSignedIn") : t("headingGuest")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {!userId
                ? t("subheadGuest")
                : enrollments.length === 0
                  ? t("subheadEmpty")
                  : t("subheadActive", { count: enrollments.length, due: totalDue })}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/learn/leaderboard">
                <Trophy className="h-4 w-4" />
                {tl("navLabel")}
              </Link>
            </Button>
            <Button asChild size="lg" className="gap-2">
              <Link href="/learn/browse">
                <Compass className="h-4 w-4" />
                {t("courseCatalog")}
              </Link>
            </Button>
          </div>
        </div>

        {enrollments.length > 0 && (
          <div className="relative mt-6 flex flex-wrap items-center gap-4">
            <DailyGoalPill earned={todayXp} goal={DAILY_XP_GOAL} label={t("dailyGoal")} doneLabel={t("dailyGoalReached")} />
            <StatPill icon={<Flame className="h-4 w-4 text-amber-500" />} label={t("bestStreak")} value={t("streakDays", { count: totalStreak })} />
            <StatPill icon={<Trophy className="h-4 w-4 text-amber-400" />} label={t("totalXp")} value={totalXP.toLocaleString()} />
            <StatPill icon={<BookOpen className="h-4 w-4 text-primary" />} label={t("dueToday")} value={totalDue.toString()} />
          </div>
        )}
      </div>

      {/* Enrolled languages */}
      {enrollments.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold">{t("continueLearning")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {enrollments.map((e) => (
              <EnrollmentCard key={e.id} enrollment={e} />
            ))}
          </div>
        </section>
      )}

      {/* Discovery catalog */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {enrollments.length > 0 ? t("discoverMore") : t("exploreCourses")}
          </h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/learn/browse">
              {t("viewAll")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {discover.length === 0 ? (
          <EmptyDiscover hasEnrollments={enrollments.length > 0} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discover.map((language) => (
              <LearnLanguageCard key={language.id} language={language} />
            ))}
          </div>
        )}
      </section>

      {!userId && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/login?callbackUrl=/learn" className="font-medium text-primary hover:underline">
            {t("signInPromptLink")}
          </Link>{" "}
          {t("signInPromptSuffix")}
        </p>
      )}
    </div>
  )
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm">
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function DailyGoalPill({ earned, goal, label, doneLabel }: { earned: number; goal: number; label: string; doneLabel: string }) {
  const percent = Math.min(100, Math.round((earned / goal) * 100))
  const done = earned >= goal
  return (
    <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm">
      {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Target className="h-4 w-4 text-primary" />}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{done ? doneLabel : label}:</span>
          <span className="font-semibold">{earned} / {goal} XP</span>
        </div>
        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all", done ? "bg-green-500" : "bg-gradient-to-r from-primary to-accent")}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

async function EnrollmentCard({ enrollment }: { enrollment: Awaited<ReturnType<typeof getLearnDashboardData>>[number] }) {
  const { language, dueCount, streak, levelInfo, course } = enrollment
  const hasDue = dueCount > 0
  const t = await getTranslations("learn.dashboard")

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md",
      hasDue && "border-primary/30"
    )}>
      {hasDue && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-accent" />}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {language.flagUrl ? (
              <Image src={language.flagUrl} alt="" width={32} height={32} className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{language.name}</CardTitle>
              {course && <p className="text-xs text-muted-foreground">{course.title}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {streak > 0 && (
              <Badge variant="secondary" className="gap-1 text-amber-600 dark:text-amber-400">
                <Flame className="h-3 w-3" />
                {streak}
              </Badge>
            )}
            {hasDue && <Badge className="gap-1">{t("dueBadge", { count: dueCount })}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("level", { level: levelInfo.level })}</span>
            <span>{t("xpRatio", { current: levelInfo.current, needed: levelInfo.needed })}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${levelInfo.percent}%` }} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild className="flex-1 gap-2" size="sm">
            <Link href={`/learn/${language.slug}/study`}>
              <Sparkles className="h-3.5 w-3.5" />
              {hasDue ? t("studyDueLabel", { count: dueCount }) : t("study")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link href={`/learn/${language.slug}`}>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

async function EmptyDiscover({ hasEnrollments }: { hasEnrollments: boolean }) {
  const t = await getTranslations("learn.dashboard")
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <GraduationCap className="h-7 w-7 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">
        {hasEnrollments ? t("emptyAllEnrolledTitle") : t("emptyNoCoursesTitle")}
      </h3>
      <p className="mb-6 max-w-sm text-muted-foreground">
        {hasEnrollments ? t("emptyAllEnrolledDesc") : t("emptyNoCoursesDesc")}
      </p>
      <Button asChild variant="outline">
        <Link href="/browse">{t("browseAllLanguages")}</Link>
      </Button>
    </div>
  )
}
