import { test, expect, expectNoPageErrors } from "./fixtures"

const SLUG = "test-language"

test.describe("public language pages", () => {
  test("language home renders (with family-tree fetch that degrades gracefully)", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${SLUG}`)
    await expect(page.getByText(/Test Language/i).first()).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("public dictionary shows seeded entries", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${SLUG}/dictionary`)
    await expect(page.getByText("hello").first()).toBeVisible()
    await expect(page.getByText("world").first()).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
