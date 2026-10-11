import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import {
  cleanupScratch,
  openStudioTab,
  scratchLanguage,
  sidebar,
  sidebarStat,
  studioPath,
  toast,
  watchDocumentLoads,
} from "./helpers"

/**
 * Regression "D" (stale UI): after an edit, navigating away and back inside the studio
 * must show the new data — never a cached copy of the page from before the edit
 * (client router cache, service worker). Every navigation here is client-side; the
 * production build's service worker is active.
 */
signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

async function expectSection(page: Page, slug: string, section: string, heading: string | RegExp) {
  await expect(page).toHaveURL(new RegExp(`${studioPath(slug, section)}$`))
  await expect(page.getByRole("main").getByRole("heading", { level: 1, name: heading })).toBeVisible()
}

test.describe("studio shows fresh data after edits (client-side navigation)", () => {
  test("dictionary: a new word is there after leaving and coming back, and with the back button", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(page.getByRole("button", { name: "kala", exact: true })).toBeVisible()
    const loads = await watchDocumentLoads(page)

    await page.getByRole("main").getByRole("button", { name: "Add Entry", exact: true }).first().click()
    const dialog = page.getByRole("dialog", { name: "Add Dictionary Entry" })
    await dialog.locator("#lemma").fill("tomi")
    await dialog.locator("#gloss").fill("river")
    await dialog.getByRole("button", { name: "Add Entry" }).click()
    await expect(page.getByRole("button", { name: "tomi", exact: true })).toBeVisible()

    await openStudioTab(page, "Overview")
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await expect(sidebarStat(page, "Entries")).toHaveText("3")

    await openStudioTab(page, "Dictionary")
    await expectSection(page, language.slug, "dictionary", "Dictionary")
    await expect(page.getByRole("button", { name: "tomi", exact: true })).toBeVisible()
    await expect(page.getByText("Showing 3 of 3 entries")).toBeVisible()

    // Back to the overview and forward again through history.
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${studioPath(language.slug)}$`))
    await expect(sidebarStat(page, "Entries")).toHaveText("3")
    await page.goForward()
    await expect(page.getByRole("button", { name: "tomi", exact: true })).toBeVisible()

    // A delete is reflected the same way.
    await page.getByRole("button", { name: "Delete tomi" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(page.getByRole("button", { name: "tomi", exact: true })).toHaveCount(0)
    await openStudioTab(page, "Alphabet")
    await expectSection(page, language.slug, "alphabet", "Alphabet")
    await expect(sidebarStat(page, "Entries")).toHaveText("2")
    await openStudioTab(page, "Dictionary")
    await expect(page.getByRole("button", { name: "kala", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "tomi", exact: true })).toHaveCount(0)

    // All of it without a single full page load.
    await loads.expectNoFullLoad()
    expectNoPageErrors(pageErrors)
  })

  test("overview: a renamed language shows its new name after visiting another section", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    const newName = `${language.name} Prime`
    await page.goto(studioPath(language.slug))
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()

    await page.getByRole("button", { name: `Edit Name: ${language.name}` }).click()
    const input = page.getByRole("textbox", { name: "Name" })
    await input.fill(newName)
    await input.press("Enter")
    await expect(toast(page, "Name updated successfully")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible()
    await expect(sidebar(page).getByRole("heading", { name: newName })).toBeVisible()

    await openStudioTab(page, "Dictionary")
    await expectSection(page, language.slug, "dictionary", "Dictionary")
    await expect(sidebar(page).getByRole("heading", { name: newName })).toBeVisible()
    await openStudioTab(page, "Overview")
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible()
    await expect(page.getByRole("button", { name: `Edit Name: ${newName}` })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("alphabet: a new symbol and the symbol count survive a round trip", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "alphabet"))
    await page.getByRole("main").getByRole("button", { name: "Add Symbol" }).click()
    const add = page.getByRole("dialog", { name: "Add Script Symbol" })
    await add.getByLabel("Lowercase").fill("z")
    await add.getByRole("button", { name: "Add Symbol" }).click()
    await expect(page.getByRole("button", { name: "Actions for z", exact: true })).toBeVisible()
    await expect(sidebarStat(page, "Symbols")).toHaveText("12")

    await openStudioTab(page, "Phonology")
    await expectSection(page, language.slug, "phonology", "Phonology")
    await expect(sidebarStat(page, "Symbols")).toHaveText("12")
    await openStudioTab(page, "Alphabet")
    await expectSection(page, language.slug, "alphabet", "Alphabet")
    await expect(page.getByRole("button", { name: "Actions for z", exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("phonology: a saved syllable structure is shown after visiting another section", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "phonology"))
    await page.getByLabel("Syllable Template").fill("CCV")
    await page.getByRole("button", { name: "Save Phonology" }).click()
    await expect(toast(page, "Phonology settings saved")).toBeVisible()

    await openStudioTab(page, "Sound Changes")
    await expectSection(page, language.slug, "sound-changes", "Sound Changes")
    await openStudioTab(page, "Phonology")
    await expectSection(page, language.slug, "phonology", "Phonology")
    await expect(page.getByLabel("Syllable Template")).toHaveValue("CCV")
    expectNoPageErrors(pageErrors)
  })
})
