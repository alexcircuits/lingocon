import { test, expect, expectNoPageErrors } from "./fixtures"

const SLUG = "test-language"

test.describe("studio (DEV_MODE auth bypass)", () => {
  test("dictionary manager renders the toolbar and seeded entries", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${SLUG}/dictionary`)
    // Decomposed DictionaryToolbar → search textbox
    await expect(page.getByRole("textbox").first()).toBeVisible()
    // Decomposed DictionaryTable → seeded entries
    await expect(page.getByText("hello").first()).toBeVisible()
    await expect(page.getByText("world").first()).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("sound-change editor loads the Go→WASM linguistics core", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${SLUG}/sound-changes`)
    // The engine badge from lib/linguistics — starts "js", flips to "wasm" once loaded.
    const badge = page.locator('[title*="linguistics core"], [title*="JavaScript engine"]')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText("wasm", { timeout: 15_000 })
    expectNoPageErrors(pageErrors)
  })

  test("courses page renders", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${SLUG}/courses`)
    await expect(page.locator("body")).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
