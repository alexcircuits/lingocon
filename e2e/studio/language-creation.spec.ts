import { test, expect, expectNoPageErrors, signedInAs, unique } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db, userId } from "../db"
import {
  cleanupLater,
  cleanupScratch,
  dashboardCard,
  expectSidebarCounts,
  skipOnboardingTours,
  studioPath,
  toast,
} from "./helpers"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))
test.beforeEach(async ({ context }) => skipOnboardingTours(context))

test.describe("create a language (owner)", () => {
  test("form: a Unicode name gets an ASCII slug; the language is on the dashboard, opens in the studio and publishes words", async ({
    page,
    pageErrors,
  }) => {
    const stamp = unique()
    const name = `Ëlvish E2E ${stamp}`
    // Unicode-aware slugs: "Ë" folds to "e" instead of being dropped.
    const slug = `elvish-e2e-${stamp}`
    cleanupLater(slug)

    await page.goto("/dashboard/new-language")
    await page.locator("#name").fill(name)
    await expect(page.locator("#slug")).toHaveValue(slug)
    await page.locator("#visibility").click()
    await page.getByRole("option", { name: "Public" }).click()
    await page.getByRole("button", { name: "Create Language" }).click()

    await expect(toast(page, "Language created successfully")).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    const stored = await db().language.findUniqueOrThrow({ where: { slug } })
    expect(stored).toMatchObject({ name, visibility: "PUBLIC", category: "CONLANG", ownerId: await userId("owner") })

    // On the dashboard, and its studio overview opens from there.
    const card = dashboardCard(page, { slug, name })
    await expect(card).toBeVisible()
    await card.click()
    await expect(page).toHaveURL(new RegExp(`${studioPath(slug)}$`))
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
    await expectSidebarCounts(page, { Entries: 0, Pages: 0, Symbols: 0, Paradigms: 0 })

    // A first word: visible at once, after a reload and on the public page.
    await page.goto(studioPath(slug, "dictionary"))
    await page.getByRole("main").getByRole("button", { name: "Add Entry", exact: true }).first().click()
    const dialog = page.getByRole("dialog", { name: "Add Dictionary Entry" })
    await dialog.locator("#lemma").fill("karethō")
    await dialog.locator("#gloss").fill("river")
    await dialog.getByRole("button", { name: "Add Entry" }).click()
    await expect(page.getByRole("button", { name: "karethō", exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("button", { name: "karethō", exact: true })).toBeVisible()

    await page.goto(`/lang/${slug}/dictionary`)
    await page.getByRole("button", { name: "Show details for karethō" }).click()
    await expect(page.getByRole("dialog")).toContainText("river")
    expectNoPageErrors(pageErrors)
  })

  test("form: the slug follows the name until edited by hand", async ({ page, pageErrors }) => {
    await page.goto("/dashboard/new-language")
    const nameField = page.locator("#name")
    const slugField = page.locator("#slug")

    // Typed key by key, as a person would.
    await nameField.pressSequentially("Tōki Бретонский ß")
    await expect(slugField).toHaveValue("toki-bretonskii-ss")
    await nameField.fill("Ŋaŧ Þorn's Tongue")
    await expect(slugField).toHaveValue("ngat-thorns-tongue")

    // A hand-edited slug is kept when the name changes.
    await slugField.fill("my-own-slug")
    await nameField.fill("Something Else")
    await expect(slugField).toHaveValue("my-own-slug")
    expectNoPageErrors(pageErrors)
  })

  test("form: a slug that is already taken is rejected with a message", async ({ page, pageErrors }) => {
    const name = `Duplicate ${unique()}`
    await page.goto("/dashboard/new-language")
    await page.locator("#name").fill(name)
    await page.locator("#slug").fill(E2E_LANGUAGES.public)
    await page.getByRole("button", { name: "Create Language" }).click()

    await expect(page.getByRole("main").getByText("A language with this slug already exists")).toBeVisible()
    await expect(toast(page, "A language with this slug already exists")).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard\/new-language$/)
    expect(await db().language.count({ where: { name } })).toBe(0)
    expectNoPageErrors(pageErrors.filter((e) => !/already exists/.test(e)))
  })

  test("guided wizard: alphabet and grammar scaffold, then the studio overview", async ({ page, pageErrors }) => {
    const stamp = unique()
    const name = `Wizard E2E ${stamp}`
    const slug = `wizard-e2e-${stamp}`
    cleanupLater(slug)

    await page.goto("/dashboard/new-language")
    await page.getByRole("button", { name: "Use Guided Setup" }).click()
    await expect(page.getByText("Create Language - Step 1 of 5")).toBeVisible()
    await page.locator("#wizard-name").fill(name)
    await expect(page.locator("#wizard-slug")).toHaveValue(slug)
    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByText("Create Language - Step 2 of 5")).toBeVisible()
    await page.locator("#word-order").click()
    await page.getByRole("option", { name: "SOV (Subject-Object-Verb)" }).click()
    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByText("Create Language - Step 3 of 5")).toBeVisible()
    await page.getByRole("button", { name: "Yes" }).click()
    await page.locator("#alphabet-type").click()
    await page.getByRole("option", { name: "Latin-based (a-z pre-filled)" }).click()
    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByText("Create Language - Step 4 of 5")).toBeVisible()
    await page.getByRole("button", { name: "Yes" }).click()
    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByText("Create Language - Step 5 of 5")).toBeVisible()
    await expect(page.getByText(`Slug: ${slug}`)).toBeVisible()
    await expect(page.getByText("Word Order: SOV")).toBeVisible()
    await page.getByRole("button", { name: "Create Language" }).click()

    await expect(page).toHaveURL(new RegExp(`${studioPath(slug)}$`))
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
    await expectSidebarCounts(page, { Entries: 0, Pages: 4, Symbols: 26, Paradigms: 0 })
    const stored = await db().language.findUniqueOrThrow({ where: { slug } })
    expect(stored.metadata).toMatchObject({ wordOrder: "SOV" })
    expectNoPageErrors(pageErrors)
  })

  test("guided wizard: the slug follows a name typed key by key", async ({ page, pageErrors }) => {
    await page.goto("/dashboard/new-language?wizard=true")
    await page.locator("#wizard-name").pressSequentially("Wizard Tongue")
    await expect(page.locator("#wizard-slug")).toHaveValue("wizard-tongue")
    expectNoPageErrors(pageErrors)
  })
})
