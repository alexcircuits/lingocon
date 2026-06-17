import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { notFound, redirect } from "next/navigation"
import { generateLessonExercises } from "@/lib/lesson-generator"
import { LessonEngine } from "./lesson-engine"
import type { VocabItem, SentenceItem, ConceptItem } from "@/lib/lesson-generator"
import { buildLessonStatuses } from "@/lib/learn-path"
import { documentToPlainText } from "@/lib/utils/tiptap-text"

export const dynamic = "force-dynamic"

async function getLessonData(lessonId: string, userId: string) {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          visibility: true,
          language: {
            select: {
              id: true, name: true, slug: true,
              fontUrl: true, fontFamily: true, fontScale: true,
              acceptRomanizedAnswers: true,
              scriptSymbols: {
                select: { symbol: true, capitalSymbol: true, latin: true },
                orderBy: { order: "asc" as const },
              },
            },
          },
        },
      },
      items: {
        orderBy: { order: "asc" },
        include: {
          dictEntry: {
            select: { 
              id: true, 
              lemma: true, 
              gloss: true, 
              ipa: true, 
              partOfSpeech: true,
              exampleSentences: {
                select: { id: true, sentence: true, translation: true, gloss: true }
              }
            },
          },
          grammarPage: { select: { id: true, title: true, slug: true, content: true } },
          text:        { select: { id: true, title: true, slug: true, content: true } },
          sentence:    { select: { id: true, sentence: true, translation: true } },
        },
      },
    },
  })

  if (!lesson || lesson.course.visibility !== "PUBLISHED") return null

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_languageId: { userId, languageId: lesson.course.language.id },
    },
  })
  if (!enrollment) return { lesson, enrollment: null }

  const completion = await prisma.lessonCompletion.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  })

  // Compute sequential unlock status across the whole course.
  const [siblings, units, completions] = await Promise.all([
    prisma.courseLesson.findMany({
      where: { courseId: lesson.course.id },
      select: {
        id: true,
        order: true,
        unitId: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.unit.findMany({
      where: { courseId: lesson.course.id },
      select: { id: true, order: true },
    }),
    prisma.lessonCompletion.findMany({
      where: { userId, lesson: { courseId: lesson.course.id } },
      select: { lessonId: true },
    }),
  ])

  const statuses = buildLessonStatuses(
    siblings.map((s) => ({ id: s.id, order: s.order, unitId: s.unitId, hasVocab: s._count.items > 0 })),
    units,
    new Set(completions.map((c) => c.lessonId)),
  )
  const locked = statuses.get(lessonId) === "locked"

  return { lesson, enrollment, completion, locked }
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>
}) {
  const { slug, lessonId } = await params
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"

  if (!session?.user?.id && !isDevMode) {
    redirect(`/login?callbackUrl=/learn/${slug}/lesson/${lessonId}`)
  }

  const userId = session?.user?.id || (await getDevUserId())
  const data = await getLessonData(lessonId, userId)

  if (!data) notFound()

  const { lesson, enrollment } = data

  // Ensure the URL slug actually matches the lesson's language.
  if (lesson.course.language.slug !== slug) notFound()

  if (!enrollment) {
    redirect(`/learn/${slug}`)
  }

  // Sequential progression: can't open a lesson until earlier ones are done.
  if (data.locked) {
    redirect(`/learn/${slug}/courses/${lesson.course.id}`)
  }

  // Build lesson content from every item type — vocab, sentences, and
  // grammar/text concept cards.
  const vocab: VocabItem[] = lesson.items
    .filter(item => item.type === "VOCAB" && item.dictEntry)
    .map(item => item.dictEntry!)

  const sentences: SentenceItem[] = lesson.items
    .filter(item => item.type === "SENTENCE" && item.sentence)
    .map(item => ({
      id: item.sentence!.id,
      sentence: item.sentence!.sentence,
      translation: item.sentence!.translation,
    }))

  const concepts: ConceptItem[] = lesson.items.flatMap((item): ConceptItem[] => {
    if (item.type === "GRAMMAR" && item.grammarPage) {
      return [{
        id: item.grammarPage.id,
        kind: "GRAMMAR" as const,
        title: item.grammarPage.title,
        body: documentToPlainText(item.grammarPage.content),
        href: `/lang/${slug}/grammar/${item.grammarPage.slug}`,
      }]
    }
    if (item.type === "TEXT" && item.text) {
      return [{
        id: item.text.id,
        kind: "TEXT" as const,
        title: item.text.title,
        body: item.text.content ? documentToPlainText(item.text.content) : "",
        href: `/lang/${slug}/texts/${item.text.slug}`,
      }]
    }
    return []
  })

  const exercises = generateLessonExercises({ vocab, sentences, concepts })

  if (exercises.length === 0) {
    redirect(`/learn/${slug}/courses/${lesson.course.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <LessonEngine
        lessonId={lessonId}
        lessonTitle={lesson.title}
        exercises={exercises}
        languageSlug={slug}
        languageName={lesson.course.language.name}
        courseId={lesson.course.id}
        fontUrl={lesson.course.language.fontUrl}
        fontFamily={lesson.course.language.fontFamily}
        fontScale={lesson.course.language.fontScale ?? 1}
        scriptSymbols={lesson.course.language.scriptSymbols}
        acceptRomanizedAnswers={lesson.course.language.acceptRomanizedAnswers ?? false}
      />
    </div>
  )
}
