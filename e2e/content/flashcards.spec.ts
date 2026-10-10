import type { Page } from "@playwright/test"
import { test, expect, expectNoPageErrors, signedInAs } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db } from "../db"
import { asAnonymous, cleanupScratchLanguages, ownerScratch } from "./helpers"

/**
 * Quick-practice flashcards and quizzes drawn from the dictionary: the studio page
 * (/studio/lang/<slug>/flashcards) and the public one (/lang/<slug>/flashcards). The deck is
 * shuffled and other specs may add words to the fixture language, so each card is checked
 * against the database by the lemma it shows.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

const LANGUAGE_NAME = "E2E Public Tongue"

async function glossesOf(languageSlug: string, lemma: string): Promise<string[]> {
  const entries = await db().dictionaryEntry.findMany({
    where: { language: { slug: languageSlug }, lemma },
    select: { gloss: true },
  })
  return entries.map((e) => e.gloss)
}

/** Starts a session from the setup screen and returns the deck size it announced. */
async function startSession(page: Page): Promise<number> {
  const start = page.getByRole("button", { name: /^Start Studying \(\d+ cards\)$/ })
  const label = await start.textContent()
  const size = Number(/\((\d+) cards\)/.exec(label ?? "")?.[1])
  expect(size).toBeGreaterThan(0)
  await start.click()
  await expect(page.getByText(`1/${size}`, { exact: true })).toBeVisible()
  return size
}

/** Flips the current flashcard and checks the answer side shows the word's gloss. */
async function flipAndCheck(page: Page, languageSlug: string): Promise<void> {
  const faces = page.getByRole("main").getByRole("heading", { level: 2 })
  const lemma = (await faces.first().textContent())?.trim() ?? ""
  const glosses = await glossesOf(languageSlug, lemma)
  expect(glosses, `"${lemma}" on the card front is a dictionary lemma`).not.toEqual([])
  expect(glosses).toContain((await faces.nth(1).textContent())?.trim())

  // The answer buttons are faded out and inert until the card is flipped.
  const answers = page.getByRole("button", { name: "Knew It! ✓" }).locator("..")
  await expect(answers).toHaveCSS("opacity", "0")
  await faces.first().click()
  await expect(answers).toHaveCSS("opacity", "1")
}

test.describe("flashcards", () => {
  test("studio flashcards flip to the gloss and advance through the deck", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${E2E_LANGUAGES.public}/flashcards`)
    await expect(page.getByRole("heading", { level: 1, name: `${LANGUAGE_NAME} Quick Practice` })).toBeVisible()

    const size = await startSession(page)
    await flipAndCheck(page, E2E_LANGUAGES.public)
    await page.getByRole("button", { name: "Knew It! ✓" }).click()
    await expect(page.getByText(`2/${size}`, { exact: true })).toBeVisible()

    await flipAndCheck(page, E2E_LANGUAGES.public)
    await page.getByRole("button", { name: "Didn't Know" }).click()
    await expect(page.getByText(`3/${size}`, { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("Exit in a studio session returns to the setup screen", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${E2E_LANGUAGES.public}/flashcards`)
    await startSession(page)
    await page.getByRole("button", { name: "Exit" }).click()
    await expect(page.getByRole("button", { name: /^Start Studying/ })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("Exit in a public session leaves for the language page", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${E2E_LANGUAGES.public}/flashcards`)
    await startSession(page)
    await page.getByRole("link", { name: "Exit" }).click()
    await page.waitForURL(`**/lang/${E2E_LANGUAGES.public}`)
    expectNoPageErrors(pageErrors)
  })

  test("public flashcards work signed out and offer enrolment", async ({ browser, baseURL }) => {
    await asAnonymous(browser, baseURL!, async (reader) => {
      await reader.goto(`/lang/${E2E_LANGUAGES.public}/flashcards`)
      await expect(reader.getByRole("heading", { level: 1, name: `${LANGUAGE_NAME} Quick Practice` })).toBeVisible()
      await expect(reader.getByRole("link", { name: new RegExp(`Enroll to learn ${LANGUAGE_NAME}`) })).toHaveAttribute(
        "href",
        `/learn/${E2E_LANGUAGES.public}`
      )

      const size = await startSession(reader)
      await flipAndCheck(reader, E2E_LANGUAGES.public)
      await reader.getByRole("button", { name: "Knew It! ✓" }).click()
      await expect(reader.getByText(`2/${size}`, { exact: true })).toBeVisible()
    })
  })

  test("a quiz question offers the right gloss among its options", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${E2E_LANGUAGES.public}/flashcards`)
    await page.getByRole("button", { name: /Quiz/ }).click()
    const size = await startSession(page)

    const question = page.getByRole("main").getByRole("heading", { level: 2 })
    const lemma = (await question.textContent())?.trim() ?? ""
    const glosses = await glossesOf(E2E_LANGUAGES.public, lemma)
    expect(glosses, `"${lemma}" is a dictionary lemma`).not.toEqual([])
    await expect(page.getByText(`What is this in English?`)).toBeVisible()

    const options = page.getByRole("main").getByRole("button").filter({ hasText: /^[A-D]/ })
    await expect(options).toHaveCount(4)
    // Other specs may add words to the fixture, so another option could share the gloss text.
    const correct = options.filter({ hasText: new RegExp(`^[A-D]${escapeRegExp(glosses[0])}$`) })
    expect(await correct.count()).toBeGreaterThanOrEqual(1)
    await correct.first().click()
    // The answer is shown briefly, then the next question comes up.
    await expect(page.getByText(`2/${size}`, { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("practice needs words: an empty dictionary cannot start a session", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC", [])
    await page.goto(`/studio/lang/${lang.slug}/flashcards`)
    await expect(page.getByRole("button", { name: "Need at least 1 word" })).toBeDisabled()
    await page.getByRole("button", { name: /Quiz/ }).click()
    await expect(page.getByRole("button", { name: "Need at least 4 words" })).toBeDisabled()
    expectNoPageErrors(pageErrors)
  })
})

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
