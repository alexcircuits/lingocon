import { test, expect, expectNoPageErrors, signedInAs, unique } from "../fixtures"
import { db } from "../db"
import { expectNotFound } from "../access/helpers"

/**
 * Community surveys: the list, answering an active survey (anonymous response), an
 * inactive survey's 404, and the admin results page. Each test makes its own survey.
 */

async function scratchSurvey(isActive = true) {
  const suffix = unique()
  return db().survey.create({
    data: {
      title: `Survey ${suffix}`,
      slug: `e2e-survey-${suffix}`,
      description: "An E2E survey.",
      isActive,
      questions: { create: [{ text: "Which conlang got you started?", type: "TEXT", required: true, order: 0 }] },
    },
    select: { id: true, slug: true, title: true },
  })
}

test.describe("stranger", () => {
  signedInAs("stranger")

  test("answers an active survey from the list", async ({ page, pageErrors }) => {
    const survey = await scratchSurvey()
    const answer = `Toki ${unique()}`
    try {
      await page.goto("/survey")
      await expect(page.getByRole("heading", { level: 1, name: "Your voice matters" })).toBeVisible()
      await page.getByRole("link").filter({ hasText: survey.title }).first().click()
      await page.waitForURL(`**/survey/${survey.slug}`)
      await page.getByPlaceholder("Type your answer...").fill(answer)
      await page.getByRole("button", { name: "Submit Response" }).click()
      await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible()
      const responses = await db().surveyResponse.findMany({ where: { surveyId: survey.id }, select: { answers: true } })
      expect(responses).toHaveLength(1)
      expect(JSON.stringify(responses[0].answers)).toContain(answer)
      expectNoPageErrors(pageErrors)
    } finally {
      await db().survey.deleteMany({ where: { id: survey.id } })
    }
  })

  test("an inactive survey is not found", async ({ page, pageErrors }) => {
    const survey = await scratchSurvey(false)
    try {
      await page.goto(`/survey/${survey.slug}`)
      await expectNotFound(page)
      expectNoPageErrors(pageErrors)
    } finally {
      await db().survey.deleteMany({ where: { id: survey.id } })
    }
  })
})

test.describe("admin", () => {
  signedInAs("admin")

  test("sees the survey and its response count on /admin/surveys", async ({ page, pageErrors }) => {
    const survey = await scratchSurvey()
    await db().surveyResponse.create({ data: { surveyId: survey.id, answers: { note: "seeded" } } })
    try {
      await page.goto("/admin/surveys")
      await expect(page.getByRole("heading", { level: 1, name: "Survey Results" })).toBeVisible()
      await expect(page.getByText(survey.title).first()).toBeVisible()
      expectNoPageErrors(pageErrors)
    } finally {
      await db().survey.deleteMany({ where: { id: survey.id } })
    }
  })
})
