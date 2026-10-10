import { test, expect, expectNoPageErrors, signedInAs, unique } from "../fixtures"
import { db } from "../db"
import {
  anonymousGet,
  asAnonymous,
  cleanupScratchLanguages,
  clickAndAwaitAction,
  expectNotFoundForReaders,
  ownerScratch,
  richTextEditor,
  sawText,
  toast,
  watchForText,
} from "./helpers"

/**
 * Texts (the language's corpus): created from inline content, always published on save (there is
 * no draft mode for texts), readable at /lang/<slug>/texts/<textSlug>, editable and deletable.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

test.describe("studio texts", () => {
  test("create from pasted content, read publicly, edit, rename and delete", async ({
    page,
    pageErrors,
    baseURL,
    browser,
  }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    const title = `The Mountain ${id}`
    const slug = `the-mountain-${id}`

    await test.step("create with inline content", async () => {
      await page.goto(`/studio/lang/${lang.slug}/texts/new`)
      await page.getByLabel("Title", { exact: true }).fill(title)
      await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug)
      // Inline ("Paste Text") is the default content source; saving publishes.
      await expect(page.getByText("Texts have no draft mode")).toBeVisible()
      const editor = await richTextEditor(page)
      await editor.click()
      await page.keyboard.type(`Kala nemi tovi ${id}.`)
      await page.keyboard.press("Enter")
      await page.keyboard.type("Second paragraph of the story.")
      await page.getByRole("button", { name: "Save Text" }).click()

      await page.waitForURL(`**/studio/lang/${lang.slug}/texts`)
      await expect(toast(page, "Text created successfully")).toBeVisible()
      const card = page.getByRole("link").filter({ hasText: title })
      await expect(card).toContainText("Published")

      const stored = await db().text.findFirstOrThrow({ where: { languageId: lang.id, title } })
      expect(stored).toMatchObject({ slug, published: true })
    })

    await test.step("readers see it in the list and on its page", async () => {
      await asAnonymous(browser, baseURL!, async (reader) => {
        await reader.goto(`/lang/${lang.slug}/texts`)
        await reader.getByRole("link").filter({ hasText: title }).click()
        await reader.waitForURL(`**/lang/${lang.slug}/texts/${slug}`)
        await expect(reader.getByRole("heading", { level: 1, name: title })).toBeVisible()
        await expect(reader.getByText(`Kala nemi tovi ${id}.`)).toBeVisible()
        await expect(reader.getByText("Second paragraph of the story.")).toBeVisible()
      })
    })

    await test.step("edit the content", async () => {
      await page.getByRole("link").filter({ hasText: title }).click()
      await page.waitForURL(`**/studio/lang/${lang.slug}/texts/${slug}`)
      const editor = await richTextEditor(page)
      await expect(editor).toContainText(`Kala nemi tovi ${id}.`)
      await editor.click()
      await page.keyboard.press("ControlOrMeta+a")
      await page.keyboard.type(`Revised story ${id}.`)
      await clickAndAwaitAction(page, page.getByRole("button", { name: "Save Changes" }))
      await expect(toast(page, "Text updated successfully")).toBeVisible()

      const { status, html } = await anonymousGet(baseURL!, `/lang/${lang.slug}/texts/${slug}`)
      expect(status).toBe(200)
      expect(html).toContain(`Revised story ${id}.`)
      expect(html).not.toContain("Second paragraph of the story.")
    })

    const renamedSlug = `the-high-mountain-${id}`
    await test.step("rename: the address follows the title without a not-found flash", async () => {
      await watchForText(page, "notFound", "This page doesn't exist in this project")
      await page.getByLabel("Title", { exact: true }).fill(`The High Mountain ${id}`)
      await clickAndAwaitAction(page, page.getByRole("button", { name: "Save Changes" }))
      await page.waitForURL(`**/studio/lang/${lang.slug}/texts/${renamedSlug}`)
      await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(renamedSlug)
      await expect(await richTextEditor(page)).toContainText(`Revised story ${id}.`)
      expect(await sawText(page, "notFound"), "the studio not-found page flashed during the rename").toBe(false)

      const renamed = await anonymousGet(baseURL!, `/lang/${lang.slug}/texts/${renamedSlug}`)
      expect(renamed.status).toBe(200)
      expect(renamed.html).toContain(`Revised story ${id}.`)
      await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/texts/${slug}`, `Revised story ${id}.`)
    })

    await test.step("delete", async () => {
      await page.getByRole("button", { name: "Delete Text" }).click()
      const dialog = page.getByRole("dialog", { name: "Delete Text" })
      await expect(dialog).toContainText("This action cannot be undone.")
      await dialog.getByRole("button", { name: "Delete", exact: true }).click()

      await page.waitForURL(`**/studio/lang/${lang.slug}/texts`)
      await expect(toast(page, "Text deleted")).toBeVisible()
      await expect(page.getByText("No texts yet")).toBeVisible()
      expect(await db().text.count({ where: { languageId: lang.id } })).toBe(0)
      await expectNotFoundForReaders(browser, baseURL!, `/lang/${lang.slug}/texts/${renamedSlug}`, `Revised story ${id}.`)
      expect((await anonymousGet(baseURL!, `/lang/${lang.slug}/texts`)).html).not.toContain(`The High Mountain ${id}`)
    })
    expectNoPageErrors(pageErrors)
  })

  test("the fixture text is listed in the studio and readable publicly", async ({ page, pageErrors, baseURL }) => {
    await page.goto("/studio/lang/e2e-public/texts")
    const card = page.getByRole("link").filter({ hasText: "The River" })
    await expect(card).toContainText("Published")
    await card.click()
    await page.waitForURL("**/studio/lang/e2e-public/texts/the-river")
    await expect(await richTextEditor(page)).toContainText("Tama suna kelo.")

    const { status, html } = await anonymousGet(baseURL!, "/lang/e2e-public/texts/the-river")
    expect(status).toBe(200)
    expect(html).toContain("Tama suna kelo.")
    expectNoPageErrors(pageErrors)
  })
})
