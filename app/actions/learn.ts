"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth, getUserId, canEditLanguage, canEditScope, canViewLanguage } from "@/lib/auth-helpers"
import { z } from "zod"
import { mediaUrlSchema } from "@/lib/validations/url"
import { scheduleReview, createNewCard, computeLessonXp, LESSON_XP, type CardTypeKey, type RatingKey, type FSRSCardState } from "@/lib/fsrs"
import { resultToRating } from "@/lib/lesson-to-review"
import { blankWholeWord } from "@/lib/cloze"
import { nextStreak } from "@/lib/streak"
import { recordStudyForFriendStreaks } from "@/lib/services/friend-streak-service"
import { State } from "ts-fsrs"
import { revalidatePath } from "next/cache"
import { checkLearnerBadges, checkDictionaryBadges } from "@/app/actions/badge"
import { toActionError } from "@/lib/errors"
import { createActivity } from "@/lib/utils/activity"
import { revalidateDictionary } from "@/lib/utils/revalidation"
import * as dictionaryService from "@/lib/services/dictionary-entry"

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

/** Minimal StudyCard shape needed to reschedule it through FSRS. */
interface ReschedulableCard {
  id: string
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: string
  lastReview: Date | null
  cardType: string
}

interface RescheduleComputed {
  cardId: string
  /** The card's lastReview at read time — used as the optimistic-lock token. */
  guardLastReview: Date | null
  updateData: Prisma.StudyCardUpdateManyMutationInput
  review: { cardId: string; rating: RatingKey; timeTaken: number; xpEarned: number }
  xp: number
}

/**
 * Pure: run ONE already-loaded StudyCard through FSRS and produce the next
 * scheduling state + the review row to write. No DB access, so the caller
 * decides how to persist it (see applyReschedule). Shared by the single-card
 * review flow (submitReview) and lesson completion.
 */
function computeReschedule(
  card: ReschedulableCard,
  rating: RatingKey,
  timeTaken: number,
  now: Date,
): RescheduleComputed {
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
    now,
  )

  return {
    cardId: card.id,
    guardLastReview: card.lastReview ?? null,
    xp,
    review: { cardId: card.id, rating, timeTaken, xpEarned: xp },
    updateData: {
      due:           next.due,
      stability:     next.stability,
      difficulty:    next.difficulty,
      elapsedDays:   next.elapsed_days,
      scheduledDays: next.scheduled_days,
      reps:          next.reps,
      lapses:        next.lapses,
      state:         fsrsStateToDb(next.state),
      lastReview:    now,
    },
  }
}

/**
 * Persist a computed reschedule inside a transaction with OPTIMISTIC
 * CONCURRENCY: the update only lands if the card's lastReview is unchanged
 * since it was read (the lock token). If a concurrent review already advanced
 * the card, this one is a no-op and returns false — the newer FSRS state wins
 * and no duplicate CardReview row is written. Prevents the lost-update race
 * when the same card is reviewed from two places at once.
 */
async function applyReschedule(
  tx: Prisma.TransactionClient,
  c: RescheduleComputed,
): Promise<boolean> {
  const res = await tx.studyCard.updateMany({
    where: { id: c.cardId, lastReview: c.guardLastReview },
    data: c.updateData,
  })
  if (res.count !== 1) return false
  await tx.cardReview.create({ data: c.review })
  return true
}

/**
 * Take a row lock on the enrollment for the rest of the transaction so that
 * concurrent reviews/lesson-completions for the same user serialize on the
 * streak-bonus / same-day-completion decisions (which are computed from a read,
 * not an atomic increment, and would otherwise double-count under a double
 * submit). Prisma has no first-class `FOR UPDATE`, so use raw SQL on the tx.
 */
async function lockEnrollment(tx: Prisma.TransactionClient, enrollmentId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "enrollments" WHERE id = ${enrollmentId} FOR UPDATE`
}

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

  const now = new Date()
  const languageId = card.enrollment.languageId

  // Interactive transaction. Two guards make it race-safe:
  //   1. lock the enrollment row (FOR UPDATE) so the streak-bonus / lastStudied
  //      decision is computed from committed state — concurrent reviews/lessons
  //      for this user can't both award the same milestone bonus;
  //   2. the per-card optimistic lock in applyReschedule (on lastReview) so two
  //      reviews of the SAME card can't both land.
  const result = await prisma.$transaction(async (tx) => {
    await lockEnrollment(tx, card.enrollmentId)
    const enr = await tx.enrollment.findUnique({
      where: { id: card.enrollmentId },
      select: { lastStudied: true, streak: true },
    })
    const streak = nextStreak(enr?.lastStudied ?? null, enr?.streak ?? 0, now)

    const fresh = await tx.studyCard.findFirst({ where: { id: cardId, enrollment: { userId } } })
    if (!fresh) return null
    const computed = computeReschedule(fresh, rating, timeTaken, now)
    if (!(await applyReschedule(tx, computed))) return null

    await tx.enrollment.update({
      where: { id: card.enrollmentId },
      data: {
        xp:          { increment: computed.xp + streak.bonusXp },
        streak:      streak.streak,
        lastStudied: now,
      },
    })
    await tx.xPEvent.create({
      data: { userId, languageId, amount: computed.xp, reason: "review" },
    })
    if (streak.bonusXp > 0) {
      await tx.xPEvent.create({
        data: { userId, languageId, amount: streak.bonusXp, reason: "streak_bonus" },
      })
    }
    return { xp: computed.xp, streak: streak.streak, streakBonusXp: streak.bonusXp, isNewDay: streak.isNewDay }
  })

  if (result === null) return { error: "Too soon" }

  // Learner badges (streaks, reviews) — fire-and-forget, never block the review.
  checkLearnerBadges(userId).catch(console.error)
  // On the first study of the day, advance shared streaks with active friends.
  if (result.isNewDay) recordStudyForFriendStreaks(userId).catch(console.error)

  return {
    data: {
      xpEarned: result.xp,
      streak: result.streak,
      streakBonusXp: result.streakBonusXp,
    },
  }
}

// ─── Lesson Completion ───────────────────────────────────────────────────────

export async function completeLesson(
  lessonId: string,
  heartsLeft: number,
  results?: { entryId: string; correct: boolean; retried?: boolean }[],
) {
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
  const hearts = Math.max(0, Math.min(LESSON_XP.maxHearts, Math.floor(heartsLeft)))
  const { isSameUtcDay } = await import("@/lib/streak")

  // Everything that depends on "is this the first completion today" and the
  // streak-bonus decision runs INSIDE a transaction that first row-locks the
  // enrollment, so a concurrent double-submit serializes and the second call
  // sees the first's committed completion (no double XP, no double streak bonus,
  // no re-run FSRS reschedule).
  const outcome = await prisma.$transaction(async (tx) => {
    await lockEnrollment(tx, enrollment.id)

    const existing = await tx.lessonCompletion.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { completedAt: true },
    })
    const enr = await tx.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { lastStudied: true, streak: true },
    })

    // First completion earns the full reward; replays earn a small bounded
    // "practice" XP, at most once per day, to prevent farming.
    const alreadyCompletedToday = existing ? isSameUtcDay(existing.completedAt, now) : false
    const xpEarned = !existing ? computeLessonXp(heartsLeft) : alreadyCompletedToday ? 0 : LESSON_XP.replay
    const streak = nextStreak(enr?.lastStudied ?? null, enr?.streak ?? 0, now)
    const enrollmentXp = xpEarned + streak.bonusXp

    await tx.lessonCompletion.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { heartsLeft: hearts, completedAt: now, ...(xpEarned > 0 ? { xpEarned } : {}) },
      create: { userId, lessonId, xpEarned, heartsLeft: hearts },
    })
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { xp: { increment: enrollmentXp }, streak: streak.streak, lastStudied: now },
    })
    if (xpEarned > 0) {
      await tx.xPEvent.create({
        data: { userId, languageId, amount: xpEarned, reason: "lesson_complete" },
      })
    }
    if (streak.bonusXp > 0) {
      await tx.xPEvent.create({
        data: { userId, languageId, amount: streak.bonusXp, reason: "streak_bonus" },
      })
    }

    // Feed lesson performance back into FSRS: reschedule any StudyCard whose
    // dictionary entry was tested in this lesson. Dedupe by entryId keeping the
    // worst outcome (any incorrect attempt ⇒ that entry counts as incorrect) and
    // OR-ing the "needed a retry" flag. A flawless lesson (every entry right on
    // the first try) stretches the interval furthest (EASY); a clean-but-not-
    // flawless recall is GOOD; a correct-but-retried recall is HARD. timeTaken
    // is 0 because lessons don't time individual answers.
    // Note: cardReview.xpEarned is recorded for analytics but is NOT added to
    // enrollment.xp — lesson XP is already computed above from heartsLeft.
    // Bound the client-supplied results so a pathological array can't hold the
    // transaction open with an unbounded reschedule loop. Real lessons are tiny.
    const boundedResults = results?.slice(0, 200)
    if (boundedResults && boundedResults.length > 0 && !alreadyCompletedToday) {
      const byEntry = new Map<string, { correct: boolean; retried: boolean }>()
      for (const r of boundedResults) {
        const prev = byEntry.get(r.entryId)
        byEntry.set(r.entryId, {
          correct: prev ? prev.correct && r.correct : r.correct,
          retried: (prev?.retried ?? false) || (r.retried ?? false),
        })
      }
      const perfect = [...byEntry.values()].every(e => e.correct && !e.retried)
      const entryIds = [...byEntry.keys()]

      const cards = await tx.studyCard.findMany({
        where: { enrollmentId: enrollment.id, dictEntryId: { in: entryIds } },
      })

      for (const card of cards) {
        const entryOutcome = byEntry.get(card.dictEntryId ?? "") ?? { correct: true, retried: false }
        const computed = computeReschedule(
          card,
          resultToRating(entryOutcome.correct, perfect, entryOutcome.retried),
          0,
          now,
        )
        // Optimistic apply: if a concurrent review already advanced this card,
        // skip it rather than clobbering the newer FSRS state.
        await applyReschedule(tx, computed)
      }
    }

    return { xpEarned, streak: streak.streak, streakBonusXp: streak.bonusXp, isNewDay: streak.isNewDay }
  })

  // Learner badges (streaks, lessons completed) — fire-and-forget.
  checkLearnerBadges(userId).catch(console.error)
  // On the first study of the day, advance shared streaks with active friends.
  if (outcome.isNewDay) recordStudyForFriendStreaks(userId).catch(console.error)

  const slug = await getSlugForLanguage(languageId)
  revalidatePath(`/learn/${slug}`)
  return { data: { xpEarned: outcome.xpEarned, streak: outcome.streak, streakBonusXp: outcome.streakBonusXp } }
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

/**
 * Learner-facing course data follows /learn/[slug]: any non-private language, or a
 * private one the current user may view (owner, collaborator, admin).
 */
async function canReadLearnerContent(languageId: string): Promise<boolean> {
  const language = await prisma.language.findUnique({ where: { id: languageId }, select: { visibility: true } })
  if (!language) return false
  if (language.visibility !== "PRIVATE") return true
  return canViewLanguage(languageId, await getUserId())
}

export async function getCoursesForLanguage(languageId: string) {
  if (!(await canReadLearnerContent(languageId))) return { data: [] }
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
  if (!(await canReadLearnerContent(course.languageId))) return { error: "Not found" }

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

/** Where a course lives: enough to authorize an edit and to invalidate the routes that render it. */
interface CourseScope {
  courseId: string
  languageId: string
  slug: string
}

const courseScopeSelect = {
  id: true,
  languageId: true,
  language: { select: { slug: true } },
} satisfies Prisma.CourseSelect

type CourseScopeRow = Prisma.CourseGetPayload<{ select: typeof courseScopeSelect }>

function toCourseScope(course: CourseScopeRow): CourseScope {
  return { courseId: course.id, languageId: course.languageId, slug: course.language.slug }
}

/**
 * Invalidate every route that renders a course: the studio list and editor and the public learn
 * pages (plus the given lessons' player pages). Without this the client router cache hands back
 * the pre-edit payload on Back or a quick return, and the editor reappears with the old course.
 * A cache failure must never turn a committed edit into a reported failure.
 */
function revalidateCourseRoutes(scope: CourseScope, lessonIds: readonly string[] = []) {
  try {
    revalidatePath(`/studio/lang/${scope.slug}/courses`)
    revalidatePath(`/studio/lang/${scope.slug}/courses/${scope.courseId}`)
    revalidatePath(`/learn/${scope.slug}`)
    revalidatePath(`/learn/${scope.slug}/courses/${scope.courseId}`)
    for (const lessonId of lessonIds) revalidatePath(`/learn/${scope.slug}/lesson/${lessonId}`)
  } catch (error) {
    console.error("[learn] Course saved; cache invalidation failed:", error)
  }
}

/** Course create/publish/delete also changes which languages the course catalog lists. */
function revalidateCourseCatalog(scope: CourseScope) {
  revalidateCourseRoutes(scope)
  try {
    revalidatePath("/learn/browse")
  } catch (error) {
    console.error("[learn] Course saved; cache invalidation failed:", error)
  }
}

/** Dictionary pages plus the studio shell, whose sidebar counts include dictionary rows. */
function revalidateDictionaryViews(slug: string) {
  try {
    revalidateDictionary(slug)
    revalidatePath(`/studio/lang/${slug}`, "layout")
  } catch (error) {
    console.error("[learn] Dictionary saved; cache invalidation failed:", error)
  }
}

/** Resolve a course's scope and confirm the caller may edit that language. */
async function requireCourseEditAccess(courseId: string, userId: string): Promise<CourseScope | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: courseScopeSelect })
  if (!course) return null
  if (!(await canEditLanguage(course.languageId, userId))) return null
  return toCourseScope(course)
}

/** Resolve a lesson's course scope and confirm the caller may edit that language. */
async function requireLessonEditAccess(lessonId: string, userId: string): Promise<CourseScope | null> {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { course: { select: courseScopeSelect } },
  })
  if (!lesson) return null
  if (!(await canEditLanguage(lesson.course.languageId, userId))) return null
  return toCourseScope(lesson.course)
}

/** Resolve a unit's course scope and confirm the caller may edit that language. */
async function requireUnitEditAccess(unitId: string, userId: string): Promise<CourseScope | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { course: { select: courseScopeSelect } },
  })
  if (!unit) return null
  if (!(await canEditLanguage(unit.course.languageId, userId))) return null
  return toCourseScope(unit.course)
}

/** Reorder payloads come straight from the client: a bounded list of ids. */
const orderedIdsSchema = z.array(z.string().min(1)).max(1000)

/**
 * Parse a client-supplied reorder list and require every id to be distinct and owned by the
 * target (lesson, course). Returns null when any id is foreign, duplicated or malformed, so the
 * caller rejects the whole request instead of writing a partial order.
 */
function ownedDistinctIds(ids: unknown, owned: readonly { id: string }[]): string[] | null {
  const parsed = orderedIdsSchema.safeParse(ids)
  if (!parsed.success) return null
  const allowed = new Set(owned.map((row) => row.id))
  const unique = new Set(parsed.data)
  if (unique.size !== parsed.data.length || !parsed.data.every((id) => allowed.has(id))) return null
  return parsed.data
}

export async function createCourse(languageId: string, title: string, description?: string) {
  const userId = await requireAuth()
  if (!(await canEditLanguage(languageId, userId))) {
    return { error: "You don't have permission to create courses for this language" }
  }

  const course = await prisma.course.create({
    data: { title, description, languageId, authorId: userId },
  })
  revalidateCourseCatalog({ courseId: course.id, languageId, slug: await getSlugForLanguage(languageId) })
  return { data: course }
}

// Explicit field allow-lists for the update actions: spreading the raw input let a caller set
// languageId/courseId and move a course or lesson into another user's language.
const courseUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  coverImage: mediaUrlSchema.optional().nullable().or(z.literal("")),
})
const lessonUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
})
const unitUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
})

export async function updateCourse(
  courseId: string,
  data: { title?: string; description?: string; visibility?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; coverImage?: string }
) {
  const userId = await requireAuth()
  const scope = await requireCourseEditAccess(courseId, userId)
  if (!scope) return { error: "Not found" }

  const parsed = courseUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid course" }
  const { coverImage, ...rest } = parsed.data
  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { ...rest, ...(coverImage !== undefined && { coverImage: coverImage || null }) },
  })
  revalidateCourseCatalog(scope)
  return { data: updated }
}

export async function updateLesson(lessonId: string, data: { title?: string; description?: string | null }) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }
  const parsed = lessonUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid lesson" }
  const updated = await prisma.courseLesson.update({ where: { id: lessonId }, data: parsed.data })
  revalidateCourseRoutes(scope, [lessonId])
  return { data: updated }
}

export async function reorderLessonItems(lessonId: string, orderedIds: string[]) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }

  // Every id must be one of this lesson's items: a foreign or repeated id rejects the whole reorder.
  const items = await prisma.lessonItem.findMany({ where: { lessonId }, select: { id: true } })
  const ids = ownedDistinctIds(orderedIds, items)
  if (!ids) return { error: "Invalid items" }

  await prisma.$transaction(
    ids.map((id, order) => prisma.lessonItem.updateMany({ where: { id, lessonId }, data: { order } }))
  )
  revalidateCourseRoutes(scope, [lessonId])
  return { data: true }
}

// Mirrors the example-sentence editor's limits (app/actions/example-sentence.ts).
const lessonSentenceSchema = z.object({
  sentence: z.string().trim().min(1, "Sentence is required").max(500),
  translation: z.string().trim().min(1, "Translation is required").max(500),
  gloss: z.string().trim().max(500).optional(),
})

const lessonVocabSchema = z.object({
  lemma: z.string().trim().min(1).max(200),
  gloss: z.string().trim().min(1).max(500),
  partOfSpeech: z.string().trim().max(50).optional(),
})

/**
 * Write an example sentence under a word and add it to a lesson. The sentence is dictionary
 * content, so this takes the same `write:dictionary` scope and limits as the example-sentence
 * editor, not merely course edit access.
 */
export async function createAndAddSentence(
  lessonId: string,
  dictEntryId: string,
  sentence: string,
  translation: string,
  gloss?: string,
) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }
  if (!(await canEditScope(scope.languageId, userId, "write:dictionary"))) {
    return { error: "You don't have permission to edit this language" }
  }
  const input = lessonSentenceSchema.safeParse({ sentence, translation, gloss })
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Invalid sentence" }

  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: dictEntryId },
    select: { languageId: true },
  })
  if (!entry || entry.languageId !== scope.languageId) {
    return { error: "Word does not belong to this language" }
  }

  const result = await prisma.$transaction(async (tx) => {
    const [lastItem, lastExample] = await Promise.all([
      tx.lessonItem.findFirst({ where: { lessonId }, orderBy: { order: "desc" }, select: { order: true } }),
      tx.exampleSentence.findFirst({ where: { dictionaryEntryId: dictEntryId }, orderBy: { order: "desc" }, select: { order: true } }),
    ])
    const s = await tx.exampleSentence.create({
      data: {
        sentence: input.data.sentence,
        translation: input.data.translation,
        gloss: input.data.gloss || null,
        dictionaryEntryId: dictEntryId,
        order: (lastExample?.order ?? -1) + 1,
      },
    })
    const i = await tx.lessonItem.create({
      data: { lessonId, type: "SENTENCE", order: (lastItem?.order ?? -1) + 1, sentenceId: s.id },
    })
    return { item: i, sentence: { id: s.id, sentence: s.sentence, translation: s.translation } }
  })

  // The sentence also appears under its word in the dictionary.
  revalidateDictionaryViews(scope.slug)
  revalidateCourseRoutes(scope, [lessonId])
  return { data: result }
}

/**
 * Create a word and add it to a lesson. The word goes through the dictionary write path
 * (`write:dictionary`, entry validation, phonotactic policy, activity log) with the lesson item
 * in the same transaction, so both commit together or not at all.
 */
export async function createAndAddVocab(
  lessonId: string,
  languageId: string,
  lemma: string,
  gloss: string,
  partOfSpeech?: string,
) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }
  if (scope.languageId !== languageId) return { error: "Language mismatch" }
  const vocab = lessonVocabSchema.safeParse({ lemma, gloss, partOfSpeech })
  if (!vocab.success) return { error: vocab.error.issues[0]?.message ?? "Invalid word" }

  try {
    const { entry, attached: item } = await dictionaryService.createEntryWithAttachment(
      { lemma: vocab.data.lemma, gloss: vocab.data.gloss, partOfSpeech: vocab.data.partOfSpeech || null, languageId },
      userId,
      async (tx, created) => {
        const last = await tx.lessonItem.findFirst({ where: { lessonId }, orderBy: { order: "desc" }, select: { order: true } })
        return tx.lessonItem.create({
          data: { lessonId, type: "VOCAB", order: (last?.order ?? -1) + 1, dictEntryId: created.id },
        })
      },
    )

    await createActivity({
      type: "CREATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: entry.id,
      languageId,
      userId,
      description: `Added dictionary entry "${entry.lemma}"`,
    })
    checkDictionaryBadges(userId).catch(console.error)

    revalidateDictionaryViews(scope.slug)
    revalidateCourseRoutes(scope, [lessonId])
    return {
      data: {
        item,
        dictEntry: { id: entry.id, lemma: entry.lemma, gloss: entry.gloss, partOfSpeech: entry.partOfSpeech },
      },
    }
  } catch (error) {
    return { ...toActionError(error, "Failed to create word") }
  }
}

export async function createLesson(courseId: string, title: string, description?: string, unitId?: string | null) {
  const userId = await requireAuth()
  const scope = await requireCourseEditAccess(courseId, userId)
  if (!scope) return { error: "Not found" }

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
  revalidateCourseRoutes(scope)
  return { data: lesson }
}

// ─── Studio: Units ─────────────────────────────────────────────────────────────

/** Create a lesson directly inside a unit (resolves the course from the unit). */
export async function createLessonInUnit(unitId: string, title: string, description?: string) {
  const userId = await requireAuth()
  const scope = await requireUnitEditAccess(unitId, userId)
  if (!scope) return { error: "Not found" }

  const lastLesson = await prisma.courseLesson.findFirst({
    where: { courseId: scope.courseId },
    orderBy: { order: "desc" },
  })

  const lesson = await prisma.courseLesson.create({
    data: { title, description, courseId: scope.courseId, unitId, order: (lastLesson?.order ?? -1) + 1 },
  })
  revalidateCourseRoutes(scope)
  return { data: lesson }
}

/** Persist a new lesson order within a course (ids may be a single group). */
export async function reorderLessons(courseId: string, orderedLessonIds: string[]) {
  const userId = await requireAuth()
  const scope = await requireCourseEditAccess(courseId, userId)
  if (!scope) return { error: "Not found" }

  const lessons = await prisma.courseLesson.findMany({ where: { courseId }, select: { id: true } })
  const ids = ownedDistinctIds(orderedLessonIds, lessons)
  if (!ids) return { error: "Invalid lessons" }

  await prisma.$transaction(
    ids.map((id, order) => prisma.courseLesson.updateMany({ where: { id, courseId }, data: { order } })),
  )
  revalidateCourseRoutes(scope)
  return { data: true }
}

/** Persist a new unit order within a course. */
export async function reorderUnits(courseId: string, orderedUnitIds: string[]) {
  const userId = await requireAuth()
  const scope = await requireCourseEditAccess(courseId, userId)
  if (!scope) return { error: "Not found" }

  const units = await prisma.unit.findMany({ where: { courseId }, select: { id: true } })
  const ids = ownedDistinctIds(orderedUnitIds, units)
  if (!ids) return { error: "Invalid units" }

  await prisma.$transaction(
    ids.map((id, order) => prisma.unit.updateMany({ where: { id, courseId }, data: { order } })),
  )
  revalidateCourseRoutes(scope)
  return { data: true }
}

export async function createUnit(courseId: string, title: string, description?: string) {
  const userId = await requireAuth()
  const scope = await requireCourseEditAccess(courseId, userId)
  if (!scope) return { error: "Not found" }

  const last = await prisma.unit.findFirst({ where: { courseId }, orderBy: { order: "desc" } })
  const unit = await prisma.unit.create({
    data: { courseId, title, description, order: (last?.order ?? -1) + 1 },
  })
  revalidateCourseRoutes(scope)
  return { data: unit }
}

export async function updateUnit(unitId: string, data: { title?: string; description?: string }) {
  const userId = await requireAuth()
  const scope = await requireUnitEditAccess(unitId, userId)
  if (!scope) return { error: "Not found" }

  const parsed = unitUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid unit" }
  const updated = await prisma.unit.update({ where: { id: unitId }, data: parsed.data })
  revalidateCourseRoutes(scope)
  return { data: updated }
}

export async function deleteUnit(unitId: string) {
  const userId = await requireAuth()
  const scope = await requireUnitEditAccess(unitId, userId)
  if (!scope) return { error: "Not found" }

  // Lessons keep existing; their unitId is set null via onDelete: SetNull.
  await prisma.unit.delete({ where: { id: unitId } })
  revalidateCourseRoutes(scope)
  return { data: true }
}

/** Assign (or unassign with null) a lesson to a unit within the same course. */
export async function setLessonUnit(lessonId: string, unitId: string | null) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }

  if (unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, courseId: scope.courseId },
      select: { id: true },
    })
    if (!unit) return { error: "Invalid unit" }
  }

  const updated = await prisma.courseLesson.update({
    where: { id: lessonId },
    data: { unitId },
  })
  revalidateCourseRoutes(scope, [lessonId])
  return { data: updated }
}

export async function addLessonItem(
  lessonId: string,
  type: "VOCAB" | "GRAMMAR" | "TEXT" | "SENTENCE",
  sourceId: string,
) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }

  // The linked content must belong to the same language as the course.
  const sourceLanguageId = await getSourceLanguageId(type, sourceId)
  if (!sourceLanguageId || sourceLanguageId !== scope.languageId) {
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
  revalidateCourseRoutes(scope, [lessonId])
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
  const item = await prisma.lessonItem.findUnique({ where: { id: itemId }, select: { lessonId: true } })
  if (!item) return { error: "Not found" }
  const scope = await requireLessonEditAccess(item.lessonId, userId)
  if (!scope) return { error: "Not found" }
  await prisma.lessonItem.delete({ where: { id: itemId } })
  revalidateCourseRoutes(scope, [item.lessonId])
  return { data: true }
}

export async function deleteLesson(lessonId: string) {
  const userId = await requireAuth()
  const scope = await requireLessonEditAccess(lessonId, userId)
  if (!scope) return { error: "Not found" }
  await prisma.courseLesson.delete({ where: { id: lessonId } })
  revalidateCourseRoutes(scope, [lessonId])
  return { data: true }
}

export async function deleteCourse(courseId: string) {
  const userId = await requireAuth()
  const scope = await requireCourseEditAccess(courseId, userId)
  if (!scope) return { error: "Not found" }
  await prisma.course.delete({ where: { id: courseId } })
  revalidateCourseCatalog(scope)
  return { data: true }
}

// ─── Card Seeding ─────────────────────────────────────────────────────────────

/**
 * Picks the first example sentence that actually contains the lemma as a whole
 * word and returns its fill-in-the-blank "front" (all occurrences masked).
 * Returns null when none of the examples contain the lemma.
 */
function firstClozeFront(
  examples: { sentence: string }[],
  lemma: string,
): string | null {
  for (const ex of examples) {
    const front = blankWholeWord(ex.sentence, lemma)
    if (front !== null) return front
  }
  return null
}

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
    select: {
      id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true,
      exampleSentences: { select: { id: true, sentence: true, translation: true }, take: 3 },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  })

  if (newEntries.length === 0) return

  const base = createNewCard()
  await prisma.studyCard.createMany({
    data: newEntries.flatMap(e => {
      const clozeFront = firstClozeFront(e.exampleSentences, e.lemma)

      return [
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
        ...(clozeFront
          ? [{
              enrollmentId: enrollment.id,
              dictEntryId:  e.id,
              cardType:     "CLOZE" as const,
              front:        clozeFront,
              back:         e.lemma,
              due:          base.due,
              stability:    base.stability,
              difficulty:   base.difficulty,
              state:        "NEW" as const,
              elapsedDays:   base.elapsed_days,
              scheduledDays: base.scheduled_days,
            }]
          : []),
      ]
    }),
    skipDuplicates: true,
  })
}

async function seedVocabCards(enrollmentId: string, languageId: string) {
  const entries = await prisma.dictionaryEntry.findMany({
    where: { languageId },
    select: {
      id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true,
      exampleSentences: { select: { id: true, sentence: true, translation: true }, take: 3 },
    },
    orderBy: { lemma: "asc" },
    take: 500, // cap initial seed
  })

  if (entries.length === 0) return

  const newCard = createNewCard()

  await prisma.studyCard.createMany({
    data: entries.flatMap(e => {
      const clozeFront = firstClozeFront(e.exampleSentences, e.lemma)

      return [
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
        ...(clozeFront
          ? [{
              enrollmentId,
              dictEntryId: e.id,
              cardType:    "CLOZE" as const,
              front:       clozeFront,
              back:        e.lemma,
              due:         newCard.due,
              stability:   newCard.stability,
              difficulty:  newCard.difficulty,
              state:       "NEW" as const,
              elapsedDays:   newCard.elapsed_days,
              scheduledDays: newCard.scheduled_days,
            }]
          : []),
      ]
    }),
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

const SEARCH_PAGE_SIZE = 50

export async function searchDictEntries(
  languageId: string,
  query: string,
  skip = 0,
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
    skip,
    take: SEARCH_PAGE_SIZE,
  })
}

export async function searchCourseSentences(
  languageId: string,
  query: string,
  skip = 0,
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
    skip,
    take: SEARCH_PAGE_SIZE,
  })
}
