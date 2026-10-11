import { test, expect, expectNoPageErrors, signedInAs } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db, userId } from "../db"
import {
  cleanupScratch,
  expectNotFound,
  interceptServerAction,
  privateLanguageId,
  scratchLanguage,
  swap,
} from "../access/helpers"
import { scratchCourse } from "./helpers"

/**
 * Learner pages for a signed-in user who is not enrolled (stranger), the public quick
 * practice (flashcards), and the learner-side visibility rules for PRIVATE languages.
 */

const SLUG = E2E_LANGUAGES.public
const NAME = "E2E Public Tongue"

test.afterEach(cleanupScratch)

test.describe("stranger", () => {
  signedInAs("stranger")

  const PAGES = [
    { path: "/learn", heading: "Your Language Journey" },
    { path: "/learn/browse", heading: "Learn a language" },
    { path: "/learn/leaderboard", heading: "Weekly Leaderboard" },
    { path: "/learn/leagues", heading: /League$/ },
    { path: "/learn/quests", heading: "Quests" },
    { path: "/survey", heading: "Your voice matters" },
  ] as const

  for (const learnPage of PAGES) {
    test(`${learnPage.path} renders`, async ({ page, pageErrors }) => {
      await page.goto(learnPage.path)
      await expect(page.getByRole("heading", { level: 1, name: learnPage.heading })).toBeVisible()
      expectNoPageErrors(pageErrors)
    })
  }

  test("the language's learn page, practice, study and progress (not enrolled)", async ({ page, pageErrors }) => {
    const enrolled = await db().enrollment.count({
      where: { userId: await userId("stranger"), language: { slug: SLUG } },
    })
    expect(enrolled, "precondition: stranger is not enrolled in e2e-public").toBe(0)

    await page.goto(`/learn/${SLUG}`)
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start Learning" })).toBeVisible()

    for (const path of ["practice", "study"]) {
      await page.goto(`/learn/${SLUG}/${path}`)
      await expect(page.getByRole("heading", { level: 1, name: "Not enrolled yet" })).toBeVisible()
    }
    await page.goto(`/learn/${SLUG}/progress`)
    await expect(page.getByText("Not enrolled in this language yet.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Go Back" })).toHaveAttribute("href", `/learn/${SLUG}`)
    expectNoPageErrors(pageErrors)
  })

  test("a private language has no learn pages", async ({ page, pageErrors }) => {
    for (const path of ["", "/study", "/practice", "/progress"]) {
      await page.goto(`/learn/${E2E_LANGUAGES.private}${path}`)
      await expectNotFound(page)
    }
    expectNoPageErrors(pageErrors)
  })

  test("cannot enroll in e2e-private (enrollment re-targeted from a public language)", async ({ page, pageErrors }) => {
    const language = await scratchLanguage("owner", { visibility: "PUBLIC" })
    const privateId = await privateLanguageId()
    const strangerId = await userId("stranger")
    await page.goto(`/learn/${language.slug}`)
    const result = await interceptServerAction(page, () => page.getByRole("button", { name: "Start Learning" }).click(), {
      match: (body) => body.includes(language.id),
      rewrite: (body) => swap(body, language.id, privateId),
    })
    expect(result.responseText).toContain("Language not found")
    expect(await db().enrollment.count({ where: { userId: strangerId, languageId: { in: [privateId, language.id] } } })).toBe(0)
    expectNoPageErrors(pageErrors)
  })

  test("a published course in a private language is not readable by course id", async ({ page, pageErrors }) => {
    const course = await scratchCourse({ visibility: "PRIVATE", vocab: true })
    for (const slug of [course.language.slug, SLUG]) {
      // A real 404, not a not-found page streamed into a 200 (no loading boundary above it).
      expect((await page.goto(`/learn/${slug}/courses/${course.courseId}`))?.status()).toBe(404)
      await expectNotFound(page)
      await expect(page.getByText(course.courseTitle)).toHaveCount(0)
      await expect(page.getByText(course.grammarTitle)).toHaveCount(0)
    }
    expectNoPageErrors(pageErrors)
  })
})

test.describe("signed out", () => {
  test("/learn shows the guest landing; enrolled-only pages ask to sign in", async ({ page, pageErrors }) => {
    await page.goto("/learn")
    await expect(page.getByRole("heading", { level: 1, name: "Learn a constructed language" })).toBeVisible()
    for (const path of ["study", "practice", "progress"]) {
      await page.goto(`/learn/${SLUG}/${path}`)
      await page.waitForURL(new RegExp(`/login\\?callbackUrl=/learn/${SLUG}/${path}`))
    }
    await page.goto("/learn/quests")
    await page.waitForURL(/\/login\?callbackUrl=\/learn\/quests/)
    expectNoPageErrors(pageErrors)
  })

  test("quick practice flashcards: work through every card to the summary", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${SLUG}/flashcards`)
    await expect(page.getByRole("heading", { level: 1, name: `${NAME} Quick Practice` })).toBeVisible()
    const start = page.getByRole("button", { name: /^Start Studying \(\d+ cards\)$/ })
    const total = Number((await start.innerText()).match(/\((\d+) cards\)/)?.[1])
    expect(total).toBeGreaterThanOrEqual(3)
    await start.click()

    // The flip card: the smallest element holding both faces (front subtitle = the
    // language name for conlang → English, back label = "Answer"). It has no role.
    const flipCard = page
      .locator("div")
      .filter({ has: page.getByText("Answer", { exact: true }) })
      .filter({ has: page.getByText(NAME, { exact: true }) })
      .last()
    for (let card = 1; card <= total; card += 1) {
      await expect(page.getByText(`${card}/${total}`, { exact: true })).toBeVisible()
      await flipCard.click()
      await page.getByRole("button", { name: card % 2 ? "Knew It! ✓" : "Didn't Know" }).click()
    }

    const knew = Math.ceil(total / 2)
    await expect(page.getByRole("heading", { level: 2, name: /Great Job!|Keep Practicing!|Perfect Score!/ })).toBeVisible()
    await expect(page.getByText(`Session complete — ${NAME} flashcards`)).toBeVisible()
    await expect(page.getByText(`${Math.round((knew / total) * 100)}%`)).toBeVisible()
    await page.getByRole("button", { name: "Study Again" }).click()
    await expect(page.getByText(`1/${total}`, { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
