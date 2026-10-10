import type { Locator } from "@playwright/test"
import { test, expect, expectNoPageErrors, signedInAs, unique, type Page } from "../fixtures"
import { authFile } from "../data"
import { db } from "../db"
import {
  addGrammarPages,
  cleanupScratchLanguages,
  documentIsMarked,
  markDocument,
  ownerScratch,
  richTextEditor,
  simulateTabAway,
} from "./helpers"

/**
 * The studio freshness notice (components/studio-freshness.tsx): a studio tab that was hidden for
 * at least a minute offers "Refresh" when it becomes visible again, because another tab or a
 * collaborator may have changed the project meanwhile. It must never reload by itself — that would
 * throw away an unsaved draft — and Refresh re-reads the server data in place.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

const NOTICE = "This project may have changed while you were away."

/** The studio sidebar's "<n> Entries" statistic — server data that only a refresh updates. */
function sidebarEntries(page: Page): Locator {
  return page.getByRole("complementary").getByText(/^\d+\s*Entries$/)
}

/**
 * Opens a grammar page in the editor (with the Playwright clock installed, so absences can be
 * simulated) and leaves an unsaved draft in both the title and the document.
 */
async function openEditorWithDraft(page: Page, languageSlug: string, pageSlug: string, id: string): Promise<Locator> {
  await page.clock.install()
  await page.goto(`/studio/lang/${languageSlug}/grammar/${pageSlug}`)
  const editor = await richTextEditor(page)
  await page.getByLabel("Title", { exact: true }).fill(`Unsaved title ${id}`)
  await editor.click()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.type(" Unsaved sentence.")
  await markDocument(page)
  return editor
}

test.describe("studio freshness notice", () => {
  test("after a change from another tab, coming back offers Refresh without reloading, and Refresh shows the new data", async ({
    page,
    pageErrors,
    browser,
    baseURL,
  }) => {
    const lang = await ownerScratch("PRIVATE")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Phrases ${id}`, slug: `phrases-${id}`, text: `Saved text ${id}.` }])
    const entriesStat = sidebarEntries(page)

    // Tab A: the grammar editor with an unsaved draft.
    const editor = await openEditorWithDraft(page, lang.slug, `phrases-${id}`, id)
    await expect(entriesStat).toHaveText(/^2\s*Entries$/)

    // Tab B (same account, another browser context): adds a dictionary entry.
    const other = await browser.newContext({ baseURL, storageState: authFile("owner") })
    try {
      const tabB = await other.newPage()
      await tabB.goto(`/studio/lang/${lang.slug}/dictionary`)
      await tabB.getByRole("button", { name: "Add Entry" }).first().click()
      await tabB.locator("#lemma").fill(`fresh${id}`)
      await tabB.locator("#gloss").fill("new word")
      await tabB.getByRole("dialog").getByRole("button", { name: "Add Entry" }).click()
      await expect(tabB.getByRole("cell", { name: `fresh${id}`, exact: true }).filter({ visible: true })).toBeVisible()
    } finally {
      await other.close()
    }
    expect(await db().dictionaryEntry.count({ where: { languageId: lang.id } })).toBe(3)

    // A short absence is not enough for the notice.
    await simulateTabAway(page, 5_000)
    await expect(page.getByText(NOTICE)).toHaveCount(0)

    // Back after more than a minute: the notice offers Refresh, and nothing reloads by itself.
    await simulateTabAway(page, 61_000)
    const notice = page.locator("[data-sonner-toast]").filter({ hasText: NOTICE })
    await expect(notice).toBeVisible()
    await expect(notice.getByRole("button", { name: "Refresh" })).toBeVisible()
    expect(await documentIsMarked(page), "the page reloaded by itself").toBe(true)
    await expect(entriesStat).toHaveText(/^2\s*Entries$/)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`Unsaved title ${id}`)
    await expect(editor).toContainText(`Saved text ${id}. Unsaved sentence.`)

    // Refresh re-reads the server data in place (a soft refresh, not a document reload).
    await notice.getByRole("button", { name: "Refresh" }).click()
    await expect(entriesStat).toHaveText(/^3\s*Entries$/)
    expect(await documentIsMarked(page), "Refresh did a full page load").toBe(true)
    await expect(notice).toHaveCount(0)

    // Nothing was saved behind the user's back.
    const stored = await db().grammarPage.findFirstOrThrow({ where: { languageId: lang.id } })
    expect(stored.title).toBe(`Phrases ${id}`)
    expectNoPageErrors(pageErrors)
  })

  test("an ignored notice expires without refreshing or reloading, so the draft survives", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PRIVATE")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Idle ${id}`, slug: `idle-${id}`, text: `Saved text ${id}.` }])
    const editor = await openEditorWithDraft(page, lang.slug, `idle-${id}`, id)

    // A change made elsewhere (written straight to the database).
    await db().dictionaryEntry.create({ data: { lemma: `elsewhere${id}`, gloss: "elsewhere", languageId: lang.id } })

    await simulateTabAway(page, 61_000)
    const notice = page.locator("[data-sonner-toast]").filter({ hasText: NOTICE })
    await expect(notice).toBeVisible()
    // The notice stays 15 s; let it run out without touching it.
    await page.clock.fastForward(20_000)
    await expect(notice).toHaveCount(0)

    expect(await documentIsMarked(page), "the page reloaded by itself").toBe(true)
    // Still the data the page was opened with: no silent refresh either.
    await expect(sidebarEntries(page)).toHaveText(/^2\s*Entries$/)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`Unsaved title ${id}`)
    await expect(editor).toContainText(`Saved text ${id}. Unsaved sentence.`)
    expectNoPageErrors(pageErrors)
  })

  test("Refresh keeps an unsaved editor draft", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PRIVATE")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Keep ${id}`, slug: `keep-${id}`, text: `Saved text ${id}.` }])
    const editor = await openEditorWithDraft(page, lang.slug, `keep-${id}`, id)

    await simulateTabAway(page, 61_000)
    await page.locator("[data-sonner-toast]").filter({ hasText: NOTICE }).getByRole("button", { name: "Refresh" }).click()
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: NOTICE })).toHaveCount(0)

    expect(await documentIsMarked(page)).toBe(true)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`Unsaved title ${id}`)
    await expect(editor).toContainText(`Saved text ${id}. Unsaved sentence.`)
    expectNoPageErrors(pageErrors)
  })

  test("going offline while away suppresses the notice", async ({ page, context, pageErrors }) => {
    const lang = await ownerScratch("PRIVATE")
    await page.clock.install()
    await page.goto(`/studio/lang/${lang.slug}/dictionary`)
    await expect(sidebarEntries(page)).toBeVisible()

    await context.setOffline(true)
    try {
      await simulateTabAway(page, 61_000)
      await expect(page.getByText(NOTICE)).toHaveCount(0)
    } finally {
      await context.setOffline(false)
    }
    expectNoPageErrors(pageErrors)
  })
})
