import { test, expect, expectNoPageErrors } from "../fixtures"
import { COOKIE_NOTICE_KEY } from "../data"
import { EN, EN_COOKIES } from "./helpers"

/**
 * The informational cookie notice and the /cookies page. Every other spec starts with the notice
 * dismissed (e2e/fixtures.ts); these use a bare context so a first visit is a first visit.
 */

// Everything the /cookies page documents. Auth.js adds __Secure-/__Host- prefixes on https.
const DOCUMENTED_COOKIE = /^(__Secure-|__Host-)?(authjs\.[\w.-]+|NEXT_LOCALE)$/

test.describe("cookie notice", () => {
  test("a first visit shows it until it is dismissed, and sets no undocumented cookie", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      await page.goto("/browse")
      const notice = page.getByRole("region", { name: EN_COOKIES.notice.label })
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(EN_COOKIES.notice.message)

      await notice.getByRole("link", { name: EN_COOKIES.notice.learnMore }).click()
      await page.waitForURL("**/cookies")
      await expect(page.getByRole("heading", { level: 1, name: EN_COOKIES.page.title })).toBeVisible()
      await expect(notice, "following the link does not count as dismissing it").toBeVisible()

      await notice.getByRole("button", { name: EN_COOKIES.notice.dismiss }).click()
      await expect(notice).toBeHidden()
      // The same key the rest of the suite pre-sets.
      expect(await page.evaluate((key) => localStorage.getItem(key), COOKIE_NOTICE_KEY)).toBe("1")

      await page.goto("/browse")
      await expect(page.getByRole("heading", { level: 1, name: "Browse" })).toBeVisible()
      await expect(notice).toHaveCount(0)

      const undocumented = (await context.cookies()).map((cookie) => cookie.name).filter((name) => !DOCUMENTED_COOKIE.test(name))
      expect(undocumented).toEqual([])
    } finally {
      await context.close()
    }
  })

  test("the cookies page lists what is stored and how visits are counted", async ({ page, pageErrors }) => {
    await page.goto("/cookies")
    await expect(page.getByRole("heading", { level: 1, name: EN_COOKIES.page.title })).toBeVisible()
    for (const name of ["authjs.session-token", "NEXT_LOCALE", "theme", COOKIE_NOTICE_KEY]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole("heading", { level: 2, name: EN_COOKIES.page.statsTitle })).toBeVisible()
    await expect(page.getByText(EN_COOKIES.page.statsOptOut)).toBeVisible()
    await expect(page.locator("footer").getByRole("link", { name: EN.footer.cookies })).toHaveAttribute("href", "/cookies")
    expectNoPageErrors(pageErrors)
  })
})
