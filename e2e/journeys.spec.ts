import { test, expect, expectNoPageErrors } from "./fixtures"

/**
 * Public reader journeys against the base seed (`npm run db:seed`, language "test-language").
 * The authoring journey moved to e2e/studio/language-creation.spec.ts.
 */

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
