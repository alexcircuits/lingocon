import { test, expect, expectNoPageErrors } from "../fixtures"
import { db } from "../db"
import { cleanupScratch, createScratchUser, signInThroughForm, skipOnboardingTours } from "../access/helpers"
import { scratchCourse } from "./helpers"

/**
 * A learner's path through a course and the spaced-repetition deck, on a scratch
 * public language with a published course (one unit, one lesson), as a fresh scratch
 * account so enrollment, XP and reviews start from zero.
 */

test.afterEach(cleanupScratch)

test("enroll from the course list, complete a lesson, see progress", async ({ page, pageErrors }) => {
  const course = await scratchCourse()
  const learner = await createScratchUser()
  await skipOnboardingTours(page)
  await signInThroughForm(page, learner)

  await page.goto(`/learn/${course.language.slug}`)
  await expect(page.getByRole("heading", { level: 1, name: course.language.name })).toBeVisible()
  const courseCard = page.locator("div").filter({ has: page.getByText(course.courseTitle, { exact: true }) })
  await courseCard.getByRole("link", { name: "View", exact: true }).last().click()
  await page.waitForURL(`**/learn/${course.language.slug}/courses/${course.courseId}`)
  await expect(page.getByText(course.lessonTitle)).toBeVisible()
  await expect(page.getByText(course.grammarTitle)).toBeVisible()

  await page.getByRole("button", { name: "Start Learning" }).click()
  await expect(page.getByText("Enrolled! Your study cards are being prepared.")).toBeVisible()
  const enrollment = await db().enrollment.findFirstOrThrow({
    where: { userId: learner.id, languageId: course.language.id },
    select: { id: true, xp: true },
  })
  expect(enrollment.xp).toBe(0)

  await page.getByRole("link", { name: "Start", exact: true }).click()
  await page.waitForURL(`**/learn/${course.language.slug}/lesson/${course.lessonId}`)
  await expect(page.getByRole("heading", { name: course.grammarTitle })).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("heading", { level: 1, name: /Flawless!|Lesson Complete!|Well done!/ })).toBeVisible()
  await expect(page.getByText(course.lessonTitle)).toBeVisible()
  const completion = await db().lessonCompletion.findUniqueOrThrow({
    where: { userId_lessonId: { userId: learner.id, lessonId: course.lessonId } },
    select: { xpEarned: true },
  })
  expect(completion.xpEarned).toBeGreaterThan(0)
  const after = await db().enrollment.findUniqueOrThrow({ where: { id: enrollment.id }, select: { xp: true } })
  expect(after.xp).toBeGreaterThanOrEqual(completion.xpEarned)

  await page.getByRole("link", { name: "Back to Course" }).click()
  await page.waitForURL(`**/learn/${course.language.slug}/courses/${course.courseId}`)
  await expect(page.getByRole("link", { name: "Review", exact: true })).toBeVisible()

  await page.goto(`/learn/${course.language.slug}/progress`)
  await expect(page.getByRole("heading", { level: 1, name: `Your Progress in ${course.language.name}` })).toBeVisible()
  await expect(page.getByText(`${after.xp.toLocaleString("en-US")} total XP`)).toBeVisible()

  await page.goto("/learn")
  await expect(page.getByText(course.language.name).first()).toBeVisible()
  expectNoPageErrors(pageErrors)
})

test("study the spaced-repetition deck: reveal and rate a card", async ({ page, pageErrors }) => {
  const course = await scratchCourse()
  const learner = await createScratchUser()
  await skipOnboardingTours(page)
  await signInThroughForm(page, learner)

  await page.goto(`/learn/${course.language.slug}`)
  await page.getByRole("button", { name: "Start Learning" }).click()
  await expect(page.getByText("Enrolled! Your study cards are being prepared.")).toBeVisible()
  // One vocab card per dictionary entry (kala, nemi) is seeded on enrollment.
  await expect
    .poll(() => db().studyCard.count({ where: { enrollment: { userId: learner.id, languageId: course.language.id } } }))
    .toBeGreaterThanOrEqual(2)

  await page.goto(`/learn/${course.language.slug}/study`)
  await page.getByRole("button", { name: "Reveal Answer" }).click()
  await page.getByRole("button", { name: /^Good/ }).click()
  await expect
    .poll(() => db().cardReview.count({ where: { card: { enrollment: { userId: learner.id } } } }))
    .toBe(1)
  // The next card comes up (or the session ends) — either way the page keeps working.
  await expect(page.getByRole("button", { name: "Reveal Answer" }).or(page.getByRole("heading", { level: 2 }))).toBeVisible()
  expectNoPageErrors(pageErrors)
})
