import { test, expect, expectNoPageErrors, signedInAs, unique } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db } from "../db"
import {
  addGrammarPages,
  anonymousGet,
  cleanupScratchLanguages,
  expectNotFoundForReaders,
  ownerScratch,
  richTextEditor,
  sawText,
  toast,
  watchForText,
} from "./helpers"

/**
 * Grammar pages in the studio: authoring with the rich-text editor and what readers then get on
 * /lang/<slug>/grammar. Every test works on its own scratch language, so creating, renaming,
 * reordering and deleting never disturb the shared fixtures or each other.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

const STUDIO_NOT_FOUND = "This page doesn't exist in this project"

test.describe("studio grammar pages", () => {
  test("the fixture pages are listed in order and open in the editor", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${E2E_LANGUAGES.public}/grammar`)
    await expect(page.getByRole("heading", { level: 1, name: "Grammar" })).toBeVisible()
    const rows = page.getByRole("row").filter({ has: page.getByRole("cell") })
    // Other specs only add pages with unique titles, so the seeded two keep the lead.
    await expect(rows.nth(0)).toContainText("Introduction")
    await expect(rows.nth(1)).toContainText("Nouns")

    await rows.nth(1).getByRole("link").click()
    await page.waitForURL(`**/studio/lang/${E2E_LANGUAGES.public}/grammar/nouns`)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Nouns")
    await expect(page.getByLabel("Slug", { exact: true })).toHaveValue("nouns")
    await expect(await richTextEditor(page)).toHaveText("Nouns do not inflect for case.")
    expectNoPageErrors(pageErrors)
  })

  test("a new page with a heading, a paragraph and bold text is listed and server-rendered publicly", async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    const title = `Morphology ${id}`

    await page.goto(`/studio/lang/${lang.slug}/grammar/new`)
    await page.getByLabel("Title", { exact: true }).fill(title)
    // The slug follows the title until it is edited by hand.
    await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`morphology-${id}`)

    const editor = await richTextEditor(page)
    await editor.click()
    // Toolbar buttons hand focus back to the editor a frame later; type only once it is back.
    await page.getByRole("button", { name: "Heading 2" }).click()
    await expect(editor).toBeFocused()
    await page.keyboard.type(`Verb classes ${id}`)
    await page.keyboard.press("Enter")
    await page.keyboard.type("Verbs agree with the ")
    await page.getByRole("button", { name: "Bold", exact: true }).click()
    await expect(editor).toBeFocused()
    await page.keyboard.type("subject")
    await page.getByRole("button", { name: "Bold", exact: true }).click()
    await expect(editor).toBeFocused()
    await page.keyboard.type(" only.")
    await expect(editor.locator("h2")).toHaveText(`Verb classes ${id}`)
    await expect(editor.locator("strong")).toHaveText("subject")

    await page.getByRole("button", { name: "Create Grammar Page" }).click()
    await page.waitForURL(`**/studio/lang/${lang.slug}/grammar`)
    await expect(toast(page, "Grammar page created successfully")).toBeVisible()
    const row = page.getByRole("row").filter({ hasText: title })
    await expect(row).toBeVisible()
    await expect(row.getByRole("cell", { name: `morphology-${id}`, exact: true })).toBeVisible()

    // Readers get the document in the server HTML (no client rendering needed).
    const { status, html } = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar/morphology-${id}`)
    expect(status).toBe(200)
    expect(html).toContain(`>${title}</h1>`)
    expect(html).toMatch(new RegExp(`<h2 id="[^"]+">Verb classes ${id}</h2>`))
    expect(html).toContain("Verbs agree with the <strong>subject</strong> only.")

    const index = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar`)
    expect(index.html).toContain(title)
    expectNoPageErrors(pageErrors)
  })

  test("an edited page shows the new content to readers on the next load", async ({ page, pageErrors, baseURL }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Syntax ${id}`, slug: `syntax-${id}`, text: `Old syntax notes ${id}.` }])
    const before = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar/syntax-${id}`)
    expect(before.html).toContain(`Old syntax notes ${id}.`)

    await page.goto(`/studio/lang/${lang.slug}/grammar/syntax-${id}`)
    const editor = await richTextEditor(page)
    await expect(editor).toContainText(`Old syntax notes ${id}.`)
    await editor.click()
    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.type(`Word order is verb-final ${id}.`)
    await page.getByRole("button", { name: "Update Page" }).click()
    await expect(toast(page, "Grammar page updated successfully")).toBeVisible()
    // An in-place save keeps the editor on the same page.
    await expect(page).toHaveURL(new RegExp(`/studio/lang/${lang.slug}/grammar/syntax-${id}$`))

    const after = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar/syntax-${id}`)
    expect(after.status).toBe(200)
    expect(after.html).toContain(`Word order is verb-final ${id}.`)
    expect(after.html).not.toContain(`Old syntax notes ${id}.`)

    // The studio editor reloads with the saved document too.
    await page.reload()
    await expect(await richTextEditor(page)).toHaveText(`Word order is verb-final ${id}.`)
    expectNoPageErrors(pageErrors)
  })

  test("renaming title and slug keeps the editor on the page without a not-found flash", async ({
    page,
    pageErrors,
    baseURL,
    browser,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    const oldSlug = `cases-${id}`
    const newSlug = `case-system-${id}`
    await addGrammarPages(lang.id, [{ title: `Cases ${id}`, slug: oldSlug, text: `Nominative and accusative ${id}.` }])

    await page.goto(`/studio/lang/${lang.slug}/grammar/${oldSlug}`)
    await richTextEditor(page)
    await watchForText(page, "notFound", STUDIO_NOT_FOUND)

    await page.getByLabel("Title", { exact: true }).fill(`Case system ${id}`)
    await page.getByLabel("Slug", { exact: true }).fill(newSlug)
    await page.getByRole("button", { name: "Update Page" }).click()

    await expect(toast(page, "Grammar page updated successfully")).toBeVisible()
    await page.waitForURL(`**/studio/lang/${lang.slug}/grammar/${newSlug}`)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`Case system ${id}`)
    await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(newSlug)
    await expect(await richTextEditor(page)).toContainText(`Nominative and accusative ${id}.`)
    expect(await sawText(page, "notFound"), "the studio not-found page flashed during the rename").toBe(false)

    // Readers: the new address serves the page; the old one no longer resolves (grammar slugs keep
    // no redirect — the save revalidates both URLs and the old one renders not-found).
    const renamed = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar/${newSlug}`)
    expect(renamed.status).toBe(200)
    expect(renamed.html).toContain(`>Case system ${id}</h1>`)
    await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/grammar/${oldSlug}`, `Nominative and accusative ${id}.`)

    // The studio's old address shows the in-shell not-found page.
    await page.goto(`/studio/lang/${lang.slug}/grammar/${oldSlug}`)
    await expect(page.getByText(STUDIO_NOT_FOUND)).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("reordering pages in the studio reorders the public grammar index", async ({ page, pageErrors, baseURL }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    const titles = [`Alpha ${id}`, `Beta ${id}`, `Gamma ${id}`]
    await addGrammarPages(
      lang.id,
      titles.map((title, i) => ({ title, slug: `page-${i}-${id}`, text: `Body ${i}.` }))
    )

    await page.goto(`/studio/lang/${lang.slug}/grammar`)
    const rows = page.getByRole("row").filter({ has: page.getByRole("cell") })
    await expect(rows).toHaveText([new RegExp(titles[0]), new RegExp(titles[1]), new RegExp(titles[2])])

    await rows.filter({ hasText: titles[0] }).getByRole("button", { name: "Move page down" }).click()
    await expect(toast(page, "Grammar page reordered successfully")).toBeVisible()
    await expect(rows).toHaveText([new RegExp(titles[1]), new RegExp(titles[0]), new RegExp(titles[2])])

    await rows.filter({ hasText: titles[2] }).getByRole("button", { name: "Move page up" }).click()
    await expect(rows).toHaveText([new RegExp(titles[1]), new RegExp(titles[2]), new RegExp(titles[0])])
    // The first row cannot move up, the last cannot move down.
    await expect(rows.first().getByRole("button", { name: "Move page up" })).toBeDisabled()
    await expect(rows.last().getByRole("button", { name: "Move page down" })).toBeDisabled()

    const { html } = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar`)
    const positions = [titles[1], titles[2], titles[0]].map((title) => html.indexOf(title))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))

    // The public page's previous/next links follow the same order.
    const middle = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar/page-2-${id}`)
    expect(middle.html.indexOf(titles[1])).toBeGreaterThan(-1)
    expect(middle.html.indexOf(titles[0])).toBeGreaterThan(-1)
    expectNoPageErrors(pageErrors)
  })

  test("deleting a page from the list removes it from the studio and the public site", async ({
    page,
    pageErrors,
    baseURL,
    browser,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [
      { title: `Keep ${id}`, slug: `keep-${id}`, text: "Stays." },
      { title: `Remove ${id}`, slug: `remove-${id}`, text: "Goes." },
    ])

    await page.goto(`/studio/lang/${lang.slug}/grammar`)
    const doomed = page.getByRole("row").filter({ hasText: `Remove ${id}` })
    const confirmMessages: string[] = []
    page.once("dialog", (dialog) => {
      confirmMessages.push(dialog.message())
      void dialog.accept()
    })
    await doomed.getByRole("button", { name: "Delete page" }).click()
    await expect(toast(page, "Grammar page deleted successfully")).toBeVisible()
    expect(confirmMessages).toEqual(["Are you sure you want to delete this grammar page?"])
    await expect(doomed).toHaveCount(0)
    await expect(page.getByRole("row").filter({ hasText: `Keep ${id}` })).toBeVisible()

    expect(await db().grammarPage.count({ where: { languageId: lang.id } })).toBe(1)
    await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/grammar/remove-${id}`, "Goes.")
    expect((await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar`)).html).not.toContain(`Remove ${id}`)
    expectNoPageErrors(pageErrors)
  })

  test("cancelling the delete confirmation keeps the page", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Survivor ${id}`, slug: `survivor-${id}`, text: "Stays." }])

    await page.goto(`/studio/lang/${lang.slug}/grammar`)
    page.once("dialog", (dialog) => void dialog.dismiss())
    await page.getByRole("row").filter({ hasText: `Survivor ${id}` }).getByRole("button", { name: "Delete page" }).click()
    await expect(page.getByRole("row").filter({ hasText: `Survivor ${id}` })).toBeVisible()
    expect(await db().grammarPage.count({ where: { languageId: lang.id } })).toBe(1)
    expectNoPageErrors(pageErrors)
  })

  test("deleting from the editor asks first, then returns to the list", async ({
    page,
    pageErrors,
    baseURL,
    browser,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Obsolete ${id}`, slug: `obsolete-${id}`, text: "Old." }])

    await page.goto(`/studio/lang/${lang.slug}/grammar/obsolete-${id}`)
    await richTextEditor(page)
    await page.getByRole("button", { name: "Delete page" }).click()
    const dialog = page.getByRole("dialog", { name: "Delete Grammar Page" })
    await expect(dialog).toContainText("This action cannot be undone.")
    await dialog.getByRole("button", { name: "Delete" }).click()

    await page.waitForURL(`**/studio/lang/${lang.slug}/grammar`)
    await expect(toast(page, "Grammar page deleted")).toBeVisible()
    await expect(page.getByText("No grammar pages yet")).toBeVisible()
    await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/grammar/obsolete-${id}`, "Old.")
    expectNoPageErrors(pageErrors)
  })

  test("a slug already used by another page is rejected without losing the draft", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await addGrammarPages(lang.id, [{ title: `Taken ${id}`, slug: `taken-${id}`, text: "Exists." }])

    await page.goto(`/studio/lang/${lang.slug}/grammar/new`)
    await page.getByLabel("Title", { exact: true }).fill(`Duplicate ${id}`)
    await page.getByLabel("Slug", { exact: true }).fill(`taken-${id}`)
    const editor = await richTextEditor(page)
    await editor.click()
    await page.keyboard.type(`Draft that must survive ${id}`)
    await page.getByRole("button", { name: "Create Grammar Page" }).click()

    await expect(page.getByText("A grammar page with this slug already exists").first()).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/grammar/new$`))
    await expect(editor).toContainText(`Draft that must survive ${id}`)
    expect(await db().grammarPage.count({ where: { languageId: lang.id } })).toBe(1)
    expectNoPageErrors(pageErrors)
  })

  test("a renamed-away or deleted grammar URL answers HTTP 404", async ({ baseURL }) => {
    const lang = await ownerScratch("PUBLIC")
    const { status } = await anonymousGet(baseURL!, `/lang/${lang.slug}/grammar/never-existed-${unique()}`)
    expect(status).toBe(404)
  })
})
