import { test, expect, expectNoPageErrors } from "./fixtures"

/**
 * Critical user journeys (DEV_MODE, seeded DB). Each creates its own data with a unique slug so
 * runs don't interfere with each other or with the smoke specs.
 */

test.describe("authoring journey", () => {
  test("create a public language, add a word, see it after reload and on the public page", async ({
    page,
    pageErrors,
  }) => {
    const stamp = Date.now().toString(36)
    const name = `Ëlvish E2E ${stamp}`
    // Unicode-aware slugs: "Ë" folds to "e" instead of being dropped.
    const slug = `elvish-e2e-${stamp}`

    await page.goto("/dashboard/new-language")
    await page.locator("#name").fill(name)
    await expect(page.locator("#slug")).toHaveValue(slug)
    await page.locator("#visibility").click()
    await page.getByRole("option", { name: "Public" }).click()
    await page.getByRole("button", { name: /create language/i }).click()
    await page.waitForURL("**/dashboard")

    await page.goto(`/studio/lang/${slug}/dictionary`)
    await page.getByRole("button", { name: "Add Entry" }).first().click()
    await page.locator("#lemma").fill("karethō")
    await page.locator("#gloss").fill("river")
    await page.getByRole("dialog").getByRole("button", { name: "Add Entry" }).click()
    await expect(page.getByRole("cell", { name: "karethō", exact: true }).filter({ visible: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("cell", { name: "karethō", exact: true }).filter({ visible: true })).toBeVisible()

    await page.goto(`/lang/${slug}/dictionary`)
    await expect(page.getByRole("button", { name: "Show details for karethō" })).toBeVisible()
    await page.getByRole("button", { name: "Show details for karethō" }).click()
    await expect(page.getByRole("dialog")).toContainText("river")
    expectNoPageErrors(pageErrors)
  })
})

test.describe("public reader", () => {
  test("dictionary search runs on the server and is linkable", async ({ page, pageErrors }) => {
    await page.goto("/lang/test-language/dictionary?q=hello")
    await expect(page.getByRole("button", { name: "Show details for hello" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Show details for world" })).toHaveCount(0)
    await expect(page.getByRole("searchbox")).toHaveValue("hello")
    expectNoPageErrors(pageErrors)
  })

  test("grammar pages are in the server-rendered HTML", async ({ request }) => {
    const res = await request.get("/lang/test-language/grammar/introduction")
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('<h1 id="introduction">Introduction</h1>')
    expect(html).toContain("This is a sample grammar page.")
  })

  test("Russian interface formats messages instead of printing keys (#51)", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "free-ru", url: baseURL! }])
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("lang", "ru")
    const footer = page.locator("footer")
    await expect(footer).toContainText("©")
    await expect(footer).not.toContainText("footer.copyright")
  })
})
