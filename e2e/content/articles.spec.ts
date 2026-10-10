import { test, expect, expectNoPageErrors, signedInAs, unique } from "../fixtures"
import { db, userId } from "../db"
import {
  anonymousGet,
  asAnonymous,
  cleanupScratchLanguages,
  clickAndAwaitAction,
  expectNotFoundForReaders,
  ownerScratch,
  paragraphs,
  richTextEditor,
  sawText,
  toast,
  watchForText,
} from "./helpers"

/**
 * Articles: drafts stay private, publishing exposes them at /lang/<slug>/articles/<articleSlug>,
 * unpublishing hides them again. Readers are checked signed out — the owner may preview drafts on
 * the public page. Each test uses its own scratch language.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

async function createPublishedArticle(languageId: string, title: string, slug: string, body: string) {
  return db().article.create({
    data: {
      title,
      slug,
      content: paragraphs(body),
      published: true,
      publishedAt: new Date(),
      languageId,
      authorId: await userId("owner"),
    },
  })
}

test.describe("studio articles", () => {
  test("a draft stays private until published, then edits show and unpublishing hides it", async ({
    page,
    pageErrors,
    baseURL,
    browser,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    const title = `Field notes ${id}`
    const slug = `field-notes-${id}`
    const publicPath = `/lang/${lang.slug}/articles/${slug}`

    await test.step("create a draft", async () => {
      await page.goto(`/studio/lang/${lang.slug}/articles/new`)
      await page.getByLabel("Title", { exact: true }).fill(title)
      // The address is derived from the title (read-only preview).
      await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug)
      await expect(page.getByRole("switch", { name: "Public" })).toHaveAttribute("aria-checked", "false")
      const editor = await richTextEditor(page)
      await editor.click()
      await page.keyboard.type(`First draft of the field notes ${id}.`)
      await page.getByRole("button", { name: "Save Article" }).click()

      await page.waitForURL(`**/studio/lang/${lang.slug}/articles`)
      await expect(toast(page, "Article created successfully")).toBeVisible()
      await expect(page.getByRole("heading", { name: "My Drafts" })).toBeVisible()
      const draftCard = page.getByRole("link").filter({ hasText: title })
      await expect(draftCard).toContainText("Pending review")

      const stored = await db().article.findFirstOrThrow({ where: { languageId: lang.id, title } })
      expect(stored).toMatchObject({ slug, published: false, publishedAt: null })
    })

    await test.step("readers cannot see the draft; the owner can preview it", async () => {
      await expectNotFoundForReaders(browser, baseURL!, publicPath, `First draft of the field notes ${id}.`)
      expect((await anonymousGet(baseURL!, `/lang/${lang.slug}/articles`)).html).not.toContain(title)

      await page.goto(publicPath)
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible()
    })

    await test.step("publish", async () => {
      await page.goto(`/studio/lang/${lang.slug}/articles`)
      await page.getByRole("link").filter({ hasText: title }).click()
      await page.waitForURL(`**/studio/lang/${lang.slug}/articles/${slug}`)
      await richTextEditor(page)
      const toggle = page.getByRole("switch", { name: "Public" })
      await toggle.click()
      await expect(toggle).toHaveAttribute("aria-checked", "true")
      await clickAndAwaitAction(page, page.getByRole("button", { name: "Save Changes" }))
      await expect(toast(page, "Article updated successfully")).toBeVisible()

      const stored = await db().article.findFirstOrThrow({ where: { languageId: lang.id, slug } })
      expect(stored.published).toBe(true)
      expect(stored.publishedAt).not.toBeNull()

      await asAnonymous(browser, baseURL!, async (reader) => {
        await reader.goto(publicPath)
        await expect(reader.getByRole("heading", { level: 1, name: title })).toBeVisible()
        await expect(reader.getByText(`First draft of the field notes ${id}.`)).toBeVisible()
        await reader.goto(`/lang/${lang.slug}/articles`)
        await expect(reader.getByRole("link").filter({ hasText: title })).toBeVisible()
      })
    })

    await test.step("edit the published article", async () => {
      const editor = await richTextEditor(page)
      await editor.click()
      await page.keyboard.press("ControlOrMeta+a")
      await page.keyboard.type(`Revised field notes ${id}.`)
      await clickAndAwaitAction(page, page.getByRole("button", { name: "Save Changes" }))

      const { status, html } = await anonymousGet(baseURL!, publicPath)
      expect(status).toBe(200)
      expect(html).toContain(`Revised field notes ${id}.`)
      expect(html).not.toContain(`First draft of the field notes ${id}.`)
    })

    await test.step("unpublish", async () => {
      const toggle = page.getByRole("switch", { name: "Public" })
      await toggle.click()
      await expect(toggle).toHaveAttribute("aria-checked", "false")
      await clickAndAwaitAction(page, page.getByRole("button", { name: "Save Changes" }))
      // The editor adopts the saved state: still a draft, same address.
      await expect(toggle).toHaveAttribute("aria-checked", "false")
      await expect(page).toHaveURL(new RegExp(`/articles/${slug}$`))
      expect((await db().article.findFirstOrThrow({ where: { languageId: lang.id, slug } })).published).toBe(false)

      await expectNotFoundForReaders(browser, baseURL!, publicPath, `Revised field notes ${id}.`)
      expect((await anonymousGet(baseURL!, `/lang/${lang.slug}/articles`)).html).not.toContain(title)
    })
    expectNoPageErrors(pageErrors)
  })

  test("renaming an article moves it to the new address without a not-found flash", async ({
    page,
    pageErrors,
    baseURL,
    browser,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await createPublishedArticle(lang.id, `Harvest ${id}`, `harvest-${id}`, `Harvest festival report ${id}.`)

    await page.goto(`/studio/lang/${lang.slug}/articles/harvest-${id}`)
    await richTextEditor(page)
    await watchForText(page, "notFound", "This page doesn't exist in this project")
    await page.getByLabel("Title", { exact: true }).fill(`Winter harvest ${id}`)
    await page.getByRole("button", { name: "Save Changes" }).click()

    await expect(toast(page, "Article updated successfully")).toBeVisible()
    await page.waitForURL(`**/studio/lang/${lang.slug}/articles/winter-harvest-${id}`)
    await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`winter-harvest-${id}`)
    await expect(await richTextEditor(page)).toContainText(`Harvest festival report ${id}.`)
    expect(await sawText(page, "notFound"), "the studio not-found page flashed during the rename").toBe(false)

    const renamed = await anonymousGet(baseURL!, `/lang/${lang.slug}/articles/winter-harvest-${id}`)
    expect(renamed.status).toBe(200)
    expect(renamed.html).toContain(`Winter harvest ${id}`)
    await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/articles/harvest-${id}`, `Harvest festival report ${id}.`)
    expectNoPageErrors(pageErrors)
  })

  test("deleting an article asks first and removes it everywhere", async ({ page, pageErrors, baseURL, browser }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    await createPublishedArticle(lang.id, `Retired ${id}`, `retired-${id}`, `Retired article body ${id}.`)

    await page.goto(`/studio/lang/${lang.slug}/articles/retired-${id}`)
    await richTextEditor(page)
    await page.getByRole("button", { name: "Delete Article" }).click()
    const dialog = page.getByRole("dialog", { name: "Delete Article" })
    await expect(dialog).toContainText("This action cannot be undone.")
    await dialog.getByRole("button", { name: "Delete", exact: true }).click()

    await page.waitForURL(`**/studio/lang/${lang.slug}/articles`)
    await expect(toast(page, "Article deleted")).toBeVisible()
    await expect(page.getByText("No published articles yet")).toBeVisible()
    expect(await db().article.count({ where: { languageId: lang.id } })).toBe(0)
    await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/articles/retired-${id}`, `Retired article body ${id}.`)
    expectNoPageErrors(pageErrors)
  })

  test("the fixture article is listed in the studio and opens in the editor", async ({ page, pageErrors }) => {
    await page.goto("/studio/lang/e2e-public/articles")
    const card = page.getByRole("link").filter({ hasText: "Welcome to the fixture" })
    await expect(card).toContainText("Published")
    await card.click()
    await page.waitForURL("**/studio/lang/e2e-public/articles/welcome")
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Welcome to the fixture")
    await expect(await richTextEditor(page)).toContainText("Published article body for E2E.")
    await expect(page.getByRole("switch", { name: "Public" })).toHaveAttribute("aria-checked", "true")
    expectNoPageErrors(pageErrors)
  })
})
