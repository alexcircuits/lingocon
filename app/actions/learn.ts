"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth, getUserId, canEditLanguage, canViewLanguage } from "@/lib/auth-helpers"
import { scheduleReview, createNewCard, computeLessonXp, LESSON_XP, type CardTypeKey, type RatingKey, type FSRSCardState } from "@/lib/fsrs"
import { nextStreak } from "@/lib/streak"
import { State } from "ts-fsrs"
import { revalidatePath } from "next/cache"

// ─── Enrollment ───────────────────────────────────────────────────────────────

export async function enrollInLanguage(languageId: string, courseId?: string) {
  const userId = await requireAuth()

  // Only allow enrolling in languages the user is allowed to see.
  const canView = await canViewLanguage(languageId, userId)
  if (!canView) return { error: "Language not found" }

  // If a course is specified, it must belong to this language and be published.
  if (courseId) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, languageId, visibility: "PUBLISHED" },
      select: { id: true },
    })
    if (!course) return { error: "Course not found" }
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
  })
  if (existing) return { data: existing }

  const enrollment = await prisma.enrollment.create({
    data: { userId, languageId, courseId: courseId ?? null },
  })

  // Seed vocab cards from all dictionary entries for this language
  await seedVocabCards(enrollment.id, languageId)

  revalidatePath(`/learn/${await getSlugForLanguage(languageId)}`)
  return { data: enrollment }
}

export async function getEnrollment(languageId: string) {
  const userId = await requireAuth()
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
    include: { course: { select: { id: true, title: true } } },
  })
  return { data: enrollment }
}

export async function getUserEnrollments() {
  const userId = await requireAuth()
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      language: { select: { id: true, name: true, slug: true, flagUrl: true } },
      course:   { select: { id: true, title: true } },
    },
    orderBy: { lastStudied: "desc" },
  })
  return { data: enrollments }
}

// ─── Study Queue ──────────────────────────────────────────────────────────────

export async function getDueCards(languageId: string, limit = 20) {
  const userId = await requireAuth()

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
  })
  if (!enrollment) return { data: [] }

  const now = new Date()

  // 70% due reviews, 30% new cards
  const reviewLimit = Math.ceil(limit * 0.7)
  const newLimit = limit - reviewLimit

  const [dueCards, newCards] = await Promise.all([
    prisma.studyCard.findMany({
      where: {
        enrollmentId: enrollment.id,
        state: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
        due: { lte: now },
      },
      orderBy: { due: "asc" },
      take: reviewLimit,
    }),
    prisma.studyCard.findMany({
      where: {
        enrollmentId: enrollment.id,
        state: "NEW",
      },
      orderBy: { createdAt: "asc" },
      take: newLimit,
    }),
  ])

  return { data: [...dueCards, ...newCards] }
}

export async function getLearnStats(languageId: string) {
  const userId = await requireAuth()

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
  })
  if (!enrollment) return { data: null }

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  const [stateCounts, dueToday, totalReviews] = await Promise.all([
    prisma.studyCard.groupBy({
      by: ["state"],
      where: { enrollmentId: enrollment.id },
      _count: true,
    }),
    prisma.studyCard.count({
      where: { enrollmentId: enrollment.id, due: { lte: tomorrow } },
    }),
    prisma.cardReview.count({
      where: { card: { enrollmentId: enrollment.id } },
    }),
  ])

  const states = Object.fromEntries(stateCounts.map(s => [s.state, s._count]))

  return {
    data: {
      enrollment,
      states: {
        new:        states["NEW"]        ?? 0,
        learning:   states["LEARNING"]   ?? 0,
        review:     states["REVIEW"]     ?? 0,
        relearning: states["RELEARNING"] ?? 0,
      },
      dueToday,
      totalReviews,
    },
  }
}

// ─── Review Submission ────────────────────────────────────────────────────────

export async function submitReview(
  cardId: string,
  rating: RatingKey,
  timeTaken: number,
) {
  const userId = await requireAuth()

  const card = await prisma.studyCard.findFirst({
    where: { id: cardId, enrollment: { userId } },
    include: { enrollment: true },
  })
  if (!card) return { error: "Card not found" }

  // Prevent double-submit and XP farming
  if (card.lastReview && Date.now() - card.lastReview.getTime() < 2000) {
    return { error: "Too soon" }
  }

  const { card: next, xp } = scheduleReview(
    {
      due:            card.due,
      stability:      card.stability,
      difficulty:     card.difficulty,
      elapsed_days:   card.elapsedDays,
      scheduled_days: card.scheduledDays,
      reps:           card.reps,
      lapses:         card.lapses,
      state:          dbStateToFSRS(card.state),
      last_review:    card.lastReview ?? undefined,
    },
    rating,
    timeTaken,
    card.cardType as CardTypeKey,
  )

  const now = new Date()
  const languageId = card.enrollment.languageId

  // Advance the daily streak using the *previous* lastStudied value, before we
  // overwrite it below. Idempotent within the same day.
  const streak = nextStreak(card.enrollment.lastStudied, card.enrollment.streak, now)
  const totalXp = xp + streak.bonusXp

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.studyCard.update({
      where: { id: cardId },
      data: {
        due:          next.due,
        stability:    next.stability,
        difficulty:   next.difficulty,
        elapsedDays:  next.elapsed_days,
        scheduledDays: next.scheduled_days,
        reps:         next.reps,
        lapses:       next.lapses,
        state:        fsrsStateToDb(next.state),
        lastReview:   now,
        updatedAt:    now,
      },
    }),
    prisma.cardReview.create({
      data: { cardId, rating, timeTaken, xpEarned: xp },
    }),
    prisma.enrollment.update({
      where: { id: card.enrollmentId },
      data: {
        xp:          { increment: totalXp },
        streak:      streak.streak,
        lastStudied: now,
      },
    }),
    prisma.xPEvent.create({
      data: { userId, languageId, amount: xp, reason: "review" },
    }),
  ]

  if (streak.bonusXp > 0) {
    ops.push(
      prisma.xPEvent.create({
        data: { userId, languageId, amount: streak.bonusXp, reason: "streak_bonus" },
      })
    )
  }

  const [updatedCard] = await prisma.$transaction(ops)

  return {
    data: {
      card: updatedCard,
      xpEarned: xp,
      streak: streak.streak,
      streakBonusXp: streak.bonusXp,
    },
  }
}

// ─── Lesson Completion ───────────────────────────────────────────────────────

export async function completeLesson(lessonId: string, heartsLeft: number) {
  const userId = await requireAuth()

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: {
      course: { select: { languageId: true, visibility: true } },
    },
  })
  if (!lesson) return { error: "Lesson not found" }

  // Only published courses can be completed (drafts/archived are not learnable).
  if (lesson.course.visibility !== "PUBLISHED") {
    return { error: "Course not available" }
  }

  const { languageId } = lesson.course

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
  })
  if (!enrollment) return { error: "Not enrolled" }

  const now = new Date()

  // XP is computed server-side. First completion earns the full reward; replays
  // earn a small bounded "practice" XP, at most once per day, to prevent farming.
  const existing = await prisma.lessonCompletion.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { completedAt: true },
  })

  const fullXp = computeLessonXp(heartsLeft)
  let xpEarned: number
  if (!existing) {
    xpEarned = fullXp
  } else {
    const { isSameUtcDay } = await import("@/lib/streak")
    xpEarned = isSameUtcDay(existing.completedAt, now) ? 0 : LESSON_XP.replay
  }

  const hearts = Math.max(0, Math.min(LESSON_XP.maxHearts, Math.floor(heartsLeft)))

  // Advance streak from the previous study timestamp before overwriting it.
  const streak = nextStreak(enrollment.lastStudied, enrollment.streak, now)
  const enrollmentXp = xpEarned + streak.bonusXp

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.lessonCompletion.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { heartsLeft: hearts, completedAt: now, ...(xpEarned > 0 ? { xpEarned } : {}) },
      create: { userId, lessonId, xpEarned, heartsLeft: hearts },
    }),
    prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { xp: { increment: enrollmentXp }, streak: streak.streak, lastStudied: now },
    }),
  ]

  if (xpEarned > 0) {
    ops.push(
      prisma.xPEvent.create({
        data: { userId, languageId, amount: xpEarned, reason: "lesson_complete" },
      })
    )
  }
  if (streak.bonusXp > 0) {
    ops.push(
      prisma.xPEvent.create({
        data: { userId, languageId, amount: streak.bonusXp, reason: "streak_bonus" },
      })
    )
  }

  await prisma.$transaction(ops)

  const slug = await getSlugForLanguage(languageId)
  revalidatePath(`/learn/${slug}`)
  return { data: { xpEarned, streak: streak.streak, streakBonusXp: streak.bonusXp } }
}

// ─── Perfect Session Bonus ────────────────────────────────────────────────────

const PERFECT_BONUS = 25

export async function awardPerfectSession(languageId: string) {
  const userId = await requireAuth()

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
  })
  if (!enrollment) return { data: { awarded: 0 } }

  // Idempotent: at most one perfect-session bonus per language per UTC day, and
  // only when the user actually reviewed cards today.
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const [alreadyAwarded, reviewedToday] = await Promise.all([
    prisma.xPEvent.findFirst({
      where: { userId, languageId, reason: "perfect_session", createdAt: { gte: startOfDay } },
      select: { id: true },
    }),
    prisma.cardReview.findFirst({
      where: { card: { enrollmentId: enrollment.id }, reviewedAt: { gte: startOfDay } },
      select: { id: true },
    }),
  ])

  if (alreadyAwarded || !reviewedToday) return { data: { awarded: 0 } }

  await prisma.$transaction([
    prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { xp: { increment: PERFECT_BONUS } },
    }),
    prisma.xPEvent.create({
      data: { userId, languageId, amount: PERFECT_BONUS, reason: "perfect_session" },
    }),
  ])

  return { data: { awarded: PERFECT_BONUS } }
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function getCoursesForLanguage(languageId: string) {
  const courses = await prisma.course.findMany({
    where: { languageId, visibility: "PUBLISHED" },
    include: {
      author: { select: { id: true, name: true, image: true } },
      _count: { select: { lessons: true, enrollments: true } },
    },
    orderBy: { order: "asc" },
  })
  return { data: courses }
}

export async function getCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      author: { select: { id: true, name: true, image: true } },
      lessons: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { items: true } },
        },
      },
    },
  })
  if (!course) return { error: "Not found" }

  // Drafts/archived courses are only visible to users who can edit the language.
  if (course.visibility !== "PUBLISHED") {
    const userId = await getUserId()
    if (!(await canEditLanguage(course.languageId, userId))) {
      return { error: "Not found" }
    }
  }
  return { data: course }
}

// ─── Studio: Course Management ────────────────────────────────────────────────

/** Resolve a course's languageId and confirm the caller may edit that language. */
async function requireCourseEditAccess(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, languageId: true },
  })
  if (!course) return null
  if (!(await canEditLanguage(course.languageId, userId))) return null
  return course
}

export async function createCourse(languageId: string, title: string, description?: string) {
  const userId = await requireAuth()
  if (!(await canEditLanguage(languageId, userId))) {
    return { error: "You don't have permission to create courses for this language" }
  }

  const course = await prisma.course.create({
    data: { title, description, languageId, authorId: userId },
  })
  revalidatePath(`/studio/lang`)
  return { data: course }
}

export async function updateCourse(
  courseId: string,
  data: { title?: string; description?: string; visibility?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; coverImage?: string }
) {
  const userId = await requireAuth()
  if (!(await requireCourseEditAccess(courseId, userId))) return { error: "Not found" }

  const updated = await prisma.course.update({ where: { id: courseId }, data })
  revalidatePath(`/studio/lang`)
  return { data: updated }
}

export async function updateLesson(lessonId: string, data: { title?: string; description?: string | null }) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }
  if (!(await canEditLanguage(lesson.course.languageId, userId))) return { error: "Not found" }
  const updated = await prisma.courseLesson.update({ where: { id: lessonId }, data })
  return { data: updated }
}

export async function reorderLessonItems(lessonId: string, orderedIds: string[]) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }
  if (!(await canEditLanguage(lesson.course.languageId, userId))) return { error: "Not found" }
  await prisma.$transaction(
    orderedIds.map((id, order) => prisma.lessonItem.update({ where: { id }, data: { order } }))
  )
  return { data: true }
}

export async function createAndAddSentence(
  lessonId: string,
  dictEntryId: string,
  sentence: string,
  translation: string,
  gloss?: string,
) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }
  if (!(await canEditLanguage(lesson.course.languageId, userId))) return { error: "Not found" }

  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: dictEntryId },
    select: { languageId: true },
  })
  if (!entry || entry.languageId !== lesson.course.languageId) {
    return { error: "Word does not belong to this language" }
  }

  const last = await prisma.lessonItem.findFirst({ where: { lessonId }, orderBy: { order: "desc" } })

  const result = await prisma.$transaction(async (tx) => {
    const s = await tx.exampleSentence.create({
      data: { sentence, translation, gloss: gloss || null, dictionaryEntryId: dictEntryId },
    })
    const i = await tx.lessonItem.create({
      data: { lessonId, type: "SENTENCE", order: (last?.order ?? -1) + 1, sentenceId: s.id },
    })
    return { item: i, sentence: { id: s.id, sentence: s.sentence, translation: s.translation } }
  })

  return { data: result }
}

export async function createAndAddVocab(
  lessonId: string,
  languageId: string,
  lemma: string,
  gloss: string,
  partOfSpeech?: string,
) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }
  if (lesson.course.languageId !== languageId) return { error: "Language mismatch" }
  if (!(await canEditLanguage(languageId, userId))) return { error: "Not found" }

  const last = await prisma.lessonItem.findFirst({ where: { lessonId }, orderBy: { order: "desc" } })

  const result = await prisma.$transaction(async (tx) => {
    const e = await tx.dictionaryEntry.create({
      data: { lemma, gloss, partOfSpeech: partOfSpeech || null, languageId },
    })
    const i = await tx.lessonItem.create({
      data: { lessonId, type: "VOCAB", order: (last?.order ?? -1) + 1, dictEntryId: e.id },
    })
    return {
      item: i,
      dictEntry: { id: e.id, lemma: e.lemma, gloss: e.gloss, partOfSpeech: e.partOfSpeech },
    }
  })

  return { data: result }
}

export async function createLesson(courseId: string, title: string, description?: string, unitId?: string | null) {
  const userId = await requireAuth()
  if (!(await requireCourseEditAccess(courseId, userId))) return { error: "Not found" }

  // A provided unit must belong to this course.
  if (unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: unitId, courseId }, select: { id: true } })
    if (!unit) return { error: "Invalid unit" }
  }

  const lastLesson = await prisma.courseLesson.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
  })

  const lesson = await prisma.courseLesson.create({
    data: { title, description, courseId, unitId: unitId ?? null, order: (lastLesson?.order ?? -1) + 1 },
  })
  revalidatePath(`/studio/lang`)
  return { data: lesson }
}

// ─── Studio: Units ─────────────────────────────────────────────────────────────

/** Create a lesson directly inside a unit (resolves the course from the unit). */
export async function createLessonInUnit(unitId: string, title: string, description?: string) {
  const userId = await requireAuth()
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, courseId: true, course: { select: { languageId: true } } },
  })
  if (!unit) return { error: "Not found" }
  if (!(await canEditLanguage(unit.course.languageId, userId))) return { error: "Not found" }

  const lastLesson = await prisma.courseLesson.findFirst({
    where: { courseId: unit.courseId },
    orderBy: { order: "desc" },
  })

  const lesson = await prisma.courseLesson.create({
    data: { title, description, courseId: unit.courseId, unitId, order: (lastLesson?.order ?? -1) + 1 },
  })
  revalidatePath(`/studio/lang`)
  return { data: lesson }
}

/** Persist a new lesson order within a course (ids may be a single group). */
export async function reorderLessons(courseId: string, orderedLessonIds: string[]) {
  const userId = await requireAuth()
  if (!(await requireCourseEditAccess(courseId, userId))) return { error: "Not found" }

  const lessons = await prisma.courseLesson.findMany({ where: { courseId }, select: { id: true } })
  const valid = new Set(lessons.map((l) => l.id))
  if (!orderedLessonIds.every((id) => valid.has(id))) return { error: "Invalid lessons" }

  await prisma.$transaction(
    orderedLessonIds.map((id, i) =>
      prisma.courseLesson.update({ where: { id }, data: { order: i } }),
    ),
  )
  revalidatePath(`/studio/lang`)
  return { data: true }
}

/** Persist a new unit order within a course. */
export async function reorderUnits(courseId: string, orderedUnitIds: string[]) {
  const userId = await requireAuth()
  if (!(await requireCourseEditAccess(courseId, userId))) return { error: "Not found" }

  const units = await prisma.unit.findMany({ where: { courseId }, select: { id: true } })
  const valid = new Set(units.map((u) => u.id))
  if (!orderedUnitIds.every((id) => valid.has(id))) return { error: "Invalid units" }

  await prisma.$transaction(
    orderedUnitIds.map((id, i) => prisma.unit.update({ where: { id }, data: { order: i } })),
  )
  revalidatePath(`/studio/lang`)
  return { data: true }
}

export async function createUnit(courseId: string, title: string, description?: string) {
  const userId = await requireAuth()
  if (!(await requireCourseEditAccess(courseId, userId))) return { error: "Not found" }

  const last = await prisma.unit.findFirst({ where: { courseId }, orderBy: { order: "desc" } })
  const unit = await prisma.unit.create({
    data: { courseId, title, description, order: (last?.order ?? -1) + 1 },
  })
  revalidatePath(`/studio/lang`)
  return { data: unit }
}

export async function updateUnit(unitId: string, data: { title?: string; description?: string }) {
  const userId = await requireAuth()
  if (!(await requireUnitEditAccess(unitId, userId))) return { error: "Not found" }

  const updated = await prisma.unit.update({ where: { id: unitId }, data })
  revalidatePath(`/studio/lang`)
  return { data: updated }
}

export async function deleteUnit(unitId: string) {
  const userId = await requireAuth()
  if (!(await requireUnitEditAccess(unitId, userId))) return { error: "Not found" }

  // Lessons keep existing; their unitId is set null via onDelete: SetNull.
  await prisma.unit.delete({ where: { id: unitId } })
  revalidatePath(`/studio/lang`)
  return { data: true }
}

/** Assign (or unassign with null) a lesson to a unit within the same course. */
export async function setLessonUnit(lessonId: string, unitId: string | null) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }
  if (!(await canEditLanguage(lesson.course.languageId, userId))) return { error: "Not found" }

  if (unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, courseId: lesson.courseId },
      select: { id: true },
    })
    if (!unit) return { error: "Invalid unit" }
  }

  const updated = await prisma.courseLesson.update({
    where: { id: lessonId },
    data: { unitId },
  })
  revalidatePath(`/studio/lang`)
  return { data: updated }
}

async function requireUnitEditAccess(unitId: string, userId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!unit) return null
  if (!(await canEditLanguage(unit.course.languageId, userId))) return null
  return unit
}

export async function addLessonItem(
  lessonId: string,
  type: "VOCAB" | "GRAMMAR" | "TEXT" | "SENTENCE",
  sourceId: string,
) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }

  const languageId = lesson.course.languageId
  if (!(await canEditLanguage(languageId, userId))) return { error: "Not found" }

  // The linked content must belong to the same language as the course.
  const sourceLanguageId = await getSourceLanguageId(type, sourceId)
  if (!sourceLanguageId || sourceLanguageId !== languageId) {
    return { error: "Invalid item: content does not belong to this language" }
  }

  const last = await prisma.lessonItem.findFirst({
    where: { lessonId },
    orderBy: { order: "desc" },
  })

  const item = await prisma.lessonItem.create({
    data: {
      lessonId,
      type,
      order: (last?.order ?? -1) + 1,
      dictEntryId:   type === "VOCAB"    ? sourceId : null,
      grammarPageId: type === "GRAMMAR"  ? sourceId : null,
      textId:        type === "TEXT"     ? sourceId : null,
      sentenceId:    type === "SENTENCE" ? sourceId : null,
    },
  })
  return { data: item }
}

/** Look up the owning languageId for a lesson-item source of the given type. */
async function getSourceLanguageId(
  type: "VOCAB" | "GRAMMAR" | "TEXT" | "SENTENCE",
  sourceId: string,
): Promise<string | null> {
  switch (type) {
    case "VOCAB": {
      const e = await prisma.dictionaryEntry.findUnique({ where: { id: sourceId }, select: { languageId: true } })
      return e?.languageId ?? null
    }
    case "GRAMMAR": {
      const g = await prisma.grammarPage.findUnique({ where: { id: sourceId }, select: { languageId: true } })
      return g?.languageId ?? null
    }
    case "TEXT": {
      const t = await prisma.text.findUnique({ where: { id: sourceId }, select: { languageId: true } })
      return t?.languageId ?? null
    }
    case "SENTENCE": {
      const s = await prisma.exampleSentence.findUnique({
        where: { id: sourceId },
        select: { entry: { select: { languageId: true } } },
      })
      return s?.entry?.languageId ?? null
    }
    default:
      return null
  }
}

export async function deleteLessonItem(itemId: string) {
  const userId = await requireAuth()
  const item = await prisma.lessonItem.findUnique({
    where: { id: itemId },
    select: { id: true, lesson: { select: { course: { select: { languageId: true } } } } },
  })
  if (!item) return { error: "Not found" }
  if (!(await canEditLanguage(item.lesson.course.languageId, userId))) return { error: "Not found" }
  await prisma.lessonItem.delete({ where: { id: itemId } })
  return { data: true }
}

export async function deleteLesson(lessonId: string) {
  const userId = await requireAuth()
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { languageId: true } } },
  })
  if (!lesson) return { error: "Not found" }
  if (!(await canEditLanguage(lesson.course.languageId, userId))) return { error: "Not found" }
  await prisma.courseLesson.delete({ where: { id: lessonId } })
  return { data: true }
}

export async function deleteCourse(courseId: string) {
  const userId = await requireAuth()
  if (!(await requireCourseEditAccess(courseId, userId))) return { error: "Not found" }
  await prisma.course.delete({ where: { id: courseId } })
  revalidatePath(`/studio/lang`)
  return { data: true }
}

// ─── Card Seeding ─────────────────────────────────────────────────────────────

/**
 * Called on every study-session start to pick up vocabulary entries added
 * after initial enrollment. Processes up to 100 new entries per call so the
 * response stays fast; subsequent sessions will gradually catch up.
 */
export async function syncNewVocabCards(languageId: string) {
  const userId = await requireAuth()

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_languageId: { userId, languageId } },
    select: { id: true },
  })
  if (!enrollment) return

  // Find which dict entry IDs already have a recognition card for this enrollment
  const existing = await prisma.studyCard.findMany({
    where: {
      enrollmentId: enrollment.id,
      cardType: "VOCAB_RECOGNITION",
      dictEntryId: { not: null },
    },
    select: { dictEntryId: true },
  })
  const seenIds = new Set(existing.map(c => c.dictEntryId as string))

  const newEntries = await prisma.dictionaryEntry.findMany({
    where: { languageId, id: { notIn: [...seenIds] } },
    select: { id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  })

  if (newEntries.length === 0) return

  const base = createNewCard()
  await prisma.studyCard.createMany({
    data: newEntries.flatMap(e => [
      {
        enrollmentId: enrollment.id,
        dictEntryId:  e.id,
        cardType:     "VOCAB_RECOGNITION" as const,
        front:        e.lemma,
        back:         `${e.gloss}${e.ipa ? `\n/${e.ipa}/` : ""}${e.partOfSpeech ? ` · ${e.partOfSpeech}` : ""}`,
        due:          base.due,
        stability:    base.stability,
        difficulty:   base.difficulty,
        state:        "NEW" as const,
        elapsedDays:   base.elapsed_days,
        scheduledDays: base.scheduled_days,
      },
      {
        enrollmentId: enrollment.id,
        dictEntryId:  e.id,
        cardType:     "VOCAB_PRODUCTION" as const,
        front:        e.gloss,
        back:         `${e.lemma}${e.ipa ? ` /${e.ipa}/` : ""}`,
        due:          base.due,
        stability:    base.stability,
        difficulty:   base.difficulty,
        state:        "NEW" as const,
        elapsedDays:   base.elapsed_days,
        scheduledDays: base.scheduled_days,
      },
    ]),
    skipDuplicates: true,
  })
}

async function seedVocabCards(enrollmentId: string, languageId: string) {
  const entries = await prisma.dictionaryEntry.findMany({
    where: { languageId },
    select: { id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true },
    orderBy: { lemma: "asc" },
    take: 500, // cap initial seed
  })

  if (entries.length === 0) return

  const newCard = createNewCard()

  await prisma.studyCard.createMany({
    data: entries.flatMap(e => [
      {
        enrollmentId,
        dictEntryId: e.id,
        cardType:    "VOCAB_RECOGNITION" as const,
        front:       e.lemma,
        back:        `${e.gloss}${e.ipa ? `\n/${e.ipa}/` : ""}${e.partOfSpeech ? ` · ${e.partOfSpeech}` : ""}`,
        due:         newCard.due,
        stability:   newCard.stability,
        difficulty:  newCard.difficulty,
        state:       "NEW" as const,
        elapsedDays:   newCard.elapsed_days,
        scheduledDays: newCard.scheduled_days,
      },
      {
        enrollmentId,
        dictEntryId: e.id,
        cardType:    "VOCAB_PRODUCTION" as const,
        front:       e.gloss,
        back:        `${e.lemma}${e.ipa ? ` /${e.ipa}/` : ""}`,
        due:         newCard.due,
        stability:   newCard.stability,
        difficulty:  newCard.difficulty,
        state:       "NEW" as const,
        elapsedDays:   newCard.elapsed_days,
        scheduledDays: newCard.scheduled_days,
      },
    ]),
    skipDuplicates: true,
  })
}

async function getSlugForLanguage(languageId: string): Promise<string> {
  const lang = await prisma.language.findUnique({
    where: { id: languageId },
    select: { slug: true },
  })
  return lang?.slug ?? ""
}

// ─── State conversion helpers ─────────────────────────────────────────────────

function dbStateToFSRS(state: string): State {
  const map: Record<string, State> = {
    NEW: State.New, LEARNING: State.Learning, REVIEW: State.Review, RELEARNING: State.Relearning,
  }
  return map[state] ?? State.New
}

function fsrsStateToDb(s: State): "NEW" | "LEARNING" | "REVIEW" | "RELEARNING" {
  const map: Record<number, "NEW" | "LEARNING" | "REVIEW" | "RELEARNING"> = {
    [State.New]: "NEW", [State.Learning]: "LEARNING",
    [State.Review]: "REVIEW", [State.Relearning]: "RELEARNING",
  }
  return map[s] ?? "NEW"
}

// ─── Course editor search ─────────────────────────────────────────────────────

export async function searchDictEntries(
  languageId: string,
  query: string,
): Promise<{ id: string; lemma: string; gloss: string; partOfSpeech: string | null }[]> {
  const userId = await getUserId()
  if (!userId) return []

  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) return []

  const q = query.trim()
  return prisma.dictionaryEntry.findMany({
    where: {
      languageId,
      ...(q
        ? {
            OR: [
              { lemma: { contains: q, mode: "insensitive" } },
              { gloss: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, lemma: true, gloss: true, partOfSpeech: true },
    orderBy: { lemma: "asc" },
    take: 60,
  })
}

export async function searchCourseSentences(
  languageId: string,
  query: string,
): Promise<{ id: string; sentence: string; translation: string }[]> {
  const userId = await getUserId()
  if (!userId) return []

  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) return []

  const q = query.trim()
  return prisma.exampleSentence.findMany({
    where: {
      entry: { languageId },
      ...(q
        ? {
            OR: [
              { sentence: { contains: q, mode: "insensitive" } },
              { translation: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, sentence: true, translation: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  })
}
