import type { Dialog } from "@playwright/test"
import { test, expect, expectNoPageErrors, signedInAs, unique, type Page } from "../fixtures"
import { db, userId } from "../db"
import { addGrammarPages, cleanupScratchLanguages, ownerScratch, paragraphs, richTextEditor } from "./helpers"

/**
 * Leaving a document editor with unsaved changes. The grammar and article editors keep the draft
 * only in the tab (no autosave), so closing or reloading the tab must at least ask first — or the
 * draft must have been saved. A clean editor must leave without a prompt.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

/** Tries to close the tab the way a user would, running beforeunload handlers. Returns the prompt
 * shown, if any (and confirms it so the tab does close). */
async function closeTab(page: Page): Promise<Dialog | null> {
  let prompt: Dialog | null = null
  page.on("dialog", (dialog) => {
    prompt = dialog
    void dialog.accept()
  })
  await page.close({ runBeforeUnload: true })
  // With a beforeunload prompt the close waits for the (auto-accepted) dialog; without one the
  // page is closed right away.
  await expect.poll(() => page.isClosed()).toBe(true)
  return prompt
}

test.describe("unsaved drafts in document editors", () => {
  test("closing the tab on a dirty grammar editor warns first or keeps the draft", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Draft target ${id}`, slug: `draft-${id}`, text: "Saved." }])

    await page.goto(`/studio/lang/${lang.slug}/grammar/draft-${id}`)
    const editor = await richTextEditor(page)
    await page.getByLabel("Title", { exact: true }).fill(`Unsaved ${id}`)
    await editor.click()
    await page.keyboard.type("Unsaved words. ")

    const prompt = await closeTab(page)
    const stored = await db().grammarPage.findFirstOrThrow({ where: { languageId: lang.id } })
    const autosaved = stored.title === `Unsaved ${id}`
    expect(prompt?.type() === "beforeunload" || autosaved, "neither warned nor autosaved").toBe(true)
    expectNoPageErrors(pageErrors)
  })

  test("closing the tab on a dirty article editor warns first or keeps the draft", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await db().article.create({
      data: {
        title: `Article draft ${id}`,
        slug: `article-draft-${id}`,
        content: paragraphs("Saved."),
        published: false,
        languageId: lang.id,
        authorId: await userId("owner"),
      },
    })

    await page.goto(`/studio/lang/${lang.slug}/articles/article-draft-${id}`)
    const editor = await richTextEditor(page)
    await editor.click()
    await page.keyboard.type("Unsaved words. ")

    const prompt = await closeTab(page)
    const stored = await db().article.findFirstOrThrow({ where: { languageId: lang.id } })
    const autosaved = JSON.stringify(stored.content).includes("Unsaved words.")
    expect(prompt?.type() === "beforeunload" || autosaved, "neither warned nor autosaved").toBe(true)
    expectNoPageErrors(pageErrors)
  })

  test("a saved grammar editor closes without a prompt", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Clean ${id}`, slug: `clean-${id}`, text: "Saved." }])

    await page.goto(`/studio/lang/${lang.slug}/grammar/clean-${id}`)
    const editor = await richTextEditor(page)
    await editor.click()
    await page.keyboard.type("More words. ")
    await page.getByRole("button", { name: "Update Page" }).click()
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Grammar page updated successfully" })).toBeVisible()

    expect(await closeTab(page)).toBeNull()
    expectNoPageErrors(pageErrors)
  })
})
