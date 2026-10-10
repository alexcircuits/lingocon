import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { getDevUserId } from "@/lib/dev-auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, ListChecks, Play, Users, Lock } from "lucide-react"
import { EnrollButton } from "../../enroll-button"
import { buildLessonStatuses, orderLessonSequence, type LessonStatus } from "@/lib/learn-path"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

async function getCourseData(courseId: string, slug: string, userId: string | null) {
  // Same rule as /learn/[slug]: published courses of non-private languages, and only
  // under their own language's URL (a course id must not unlock a private language).
  const course = await prisma.course.findFirst({
    where: { id: courseId, visibility: "PUBLISHED", language: { slug, visibility: { not: "PRIVATE" } } },
    include: {
      language: { select: { id: true, name: true, slug: true } },
      author:   { select: { id: true, name: true, image: true } },
      units: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, description: true, order: true },
      },
      lessons: {
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { order: "asc" },
            include: {
              dictEntry:   { select: { id: true, lemma: true, gloss: true, partOfSpeech: true } },
              grammarPage: { select: { id: true, title: true, slug: true } },
              text:        { select: { id: true, title: true, type: true } },
              sentence:    { select: { id: true, sentence: true, translation: true } },
            },
          },
          _count: { select: { items: true } },
        },
      },
    },
  })

  if (!course) return null

  const enrollment = userId
    ? await prisma.enrollment.findUnique({
        where: { userId_languageId: { userId, languageId: course.language.id } },
      })
    : null

  // Fetch which lessons this user has already completed
  const completions = userId
    ? await prisma.lessonCompletion.findMany({
        where: { userId, lessonId: { in: course.lessons.map(l => l.id) } },
        select: { lessonId: true, heartsLeft: true },
      })
    : []
  const completedLessonIds = new Set(completions.map(c => c.lessonId))

  // Learner count = distinct users who have completed at least one lesson here.
  // (Enrollment is per-language, not per-course, so we derive course-level reach.)
  const learnerGroups = await prisma.lessonCompletion.groupBy({
    by: ["userId"],
    where: { lesson: { courseId } },
  })
  const learnerCount = learnerGroups.length

  return { course, enrollment, completedLessonIds, learnerCount }
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>
}) {
  const { slug, courseId } = await params
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  const userId = session?.user?.id || (isDevMode ? await getDevUserId() : null)

  const data = await getCourseData(courseId, slug, userId)
  if (!data) notFound()

  const { course, enrollment, completedLessonIds, learnerCount } = data
  const totalItems = course.lessons.reduce((s, l) => s + l._count.items, 0)
  const completedCount = completedLessonIds.size

  // Build the ordered path + per-lesson unlock status.
  const pathInput = course.lessons.map((l) => ({
    id: l.id,
    order: l.order,
    unitId: l.unitId,
    hasVocab: l._count.items > 0,
  }))
  const statuses = buildLessonStatuses(pathInput, course.units, completedLessonIds)
  const orderedLessons = orderLessonSequence(course.lessons, course.units)

  // Group ordered lessons by unit for display (unit-less lessons trail).
  const unitsById = new Map(course.units.map((u) => [u.id, u]))
  const groups: { unit: (typeof course.units)[number] | null; lessons: typeof orderedLessons }[] = []
  for (const lesson of orderedLessons) {
    const unit = lesson.unitId ? unitsById.get(lesson.unitId) ?? null : null
    const last = groups[groups.length - 1]
    if (last && last.unit?.id === unit?.id) {
      last.lessons.push(lesson)
    } else {
      groups.push({ unit, lessons: [lesson] })
    }
  }
  const hasUnits = course.units.length > 0
  let globalIndex = 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2">
          <Link href={`/learn/${slug}`}>
            <ArrowLeft className="h-4 w-4" />
            {course.language.name}
          </Link>
        </Button>
      </div>

      {/* Course header */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-border/50 bg-card/50 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Course · {course.language.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{course.title}</h1>
            {course.description && (
              <p className="text-muted-foreground max-w-xl">{course.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <InfoChip icon={<ListChecks className="h-3.5 w-3.5" />} label={`${course.lessons.length} lessons`} />
              <InfoChip icon={<BookOpen className="h-3.5 w-3.5" />} label={`${totalItems} items`} />
              <InfoChip icon={<Users className="h-3.5 w-3.5" />} label={`${learnerCount} learners`} />
            </div>
          </div>
          <div className="shrink-0">
            {enrollment ? (
              <Button asChild size="lg" className="gap-2">
                <Link href={`/learn/${slug}/study`}>Start Studying</Link>
              </Button>
            ) : (
              <EnrollButton languageId={course.language.id} slug={slug} />
            )}
          </div>
        </div>
      </div>

      {/* Lessons */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Lessons</h2>
            {enrollment && course.lessons.length > 0 && (
              <span className="text-sm font-medium text-muted-foreground">
                {Math.round((completedCount / course.lessons.length) * 100)}% completed
              </span>
            )}
          </div>
          {enrollment && course.lessons.length > 0 && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(completedCount / course.lessons.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {groups.map((group, gi) => (
          <div key={group.unit?.id ?? `loose-${gi}`} className="space-y-3">
            {hasUnits && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                    {group.unit ? `Unit ${gi + 1}` : "More"}
                  </span>
                  <h3 className="font-semibold">{group.unit?.title ?? "Additional lessons"}</h3>
                </div>
                <div className="h-px flex-1 bg-border/60" />
              </div>
            )}
            {group.unit?.description && (
              <p className="text-sm text-muted-foreground">{group.unit.description}</p>
            )}

            {group.lessons.map((lesson) => {
              const number = ++globalIndex
              const status = statuses.get(lesson.id) ?? "open"
              return (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  number={number}
                  status={status}
                  enrolled={Boolean(enrollment)}
                  slug={slug}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function LessonRow({
  lesson,
  number,
  status,
  enrolled,
  slug,
}: {
  lesson: {
    id: string
    title: string
    description: string | null
    items: { id: string; type: string; dictEntry: { lemma: string; gloss: string } | null; grammarPage: { title: string } | null; text: { title: string } | null; sentence: { sentence: string } | null }[]
    _count: { items: number }
  }
  number: number
  status: LessonStatus
  enrolled: boolean
  slug: string
}) {
  const isDone = status === "done"
  const isLocked = status === "locked"
  const playable = status === "done" || status === "current"

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        isDone
          ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-800/50 dark:bg-emerald-950/10"
          : isLocked
            ? "opacity-70"
            : "hover:border-primary/30",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              isDone
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50"
                : isLocked
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary",
            )}
          >
            {isDone ? <CheckCircle2 className="h-5 w-5" /> : isLocked ? <Lock className="h-4 w-4" /> : number}
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{lesson.title}</CardTitle>
            {lesson.description && <CardDescription className="text-xs">{lesson.description}</CardDescription>}
          </div>

          {enrolled && playable ? (
            <Button asChild size="sm" variant={isDone ? "outline" : "default"} className="shrink-0 gap-1.5">
              <Link href={`/learn/${slug}/lesson/${lesson.id}`}>
                <Play className="h-3.5 w-3.5" />
                {isDone ? "Review" : "Start"}
              </Link>
            </Button>
          ) : isLocked ? (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              {lesson._count.items} items
            </Badge>
          )}
        </div>
      </CardHeader>

      {!isLocked && lesson.items.length > 0 && (
        <CardContent className="pt-0">
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {lesson.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                <ItemTypeIcon type={item.type} />
                <span className="truncate">
                  {item.type === "VOCAB" && item.dictEntry ? (
                    <>
                      <strong>{item.dictEntry.lemma}</strong> — {item.dictEntry.gloss}
                    </>
                  ) : item.type === "GRAMMAR" && item.grammarPage ? (
                    item.grammarPage.title
                  ) : item.type === "TEXT" && item.text ? (
                    item.text.title
                  ) : item.type === "SENTENCE" && item.sentence ? (
                    <em>{item.sentence.sentence}</em>
                  ) : (
                    "Item"
                  )}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </div>
  )
}

function ItemTypeIcon({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    VOCAB:    { label: "W", color: "bg-primary/10 text-primary" },
    GRAMMAR:  { label: "G", color: "bg-amber-500/10 text-amber-600" },
    TEXT:     { label: "T", color: "bg-blue-500/10 text-blue-600" },
    SENTENCE: { label: "S", color: "bg-emerald-500/10 text-emerald-600" },
  }
  const { label, color } = map[type] ?? { label: "?", color: "bg-secondary" }
  return (
    <span className={`h-5 w-5 rounded text-xs font-bold flex items-center justify-center shrink-0 ${color}`}>
      {label}
    </span>
  )
}
