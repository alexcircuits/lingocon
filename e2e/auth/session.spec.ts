import { test, expect, expectNoPageErrors, signedInAs } from "../fixtures"
import { E2E_LANGUAGES, E2E_USERS } from "../data"
import { EN } from "../public/helpers"
import { sessionEmail } from "./helpers"

/**
 * Pages that need an account send signed-out visitors to /login. Several of them sit
 * below a loading.tsx boundary, so the redirect is streamed (HTTP 200 + client-side
 * replace) — assert where the browser ends up, not the status code.
 */
test.describe("signed-out visitors are sent to /login", () => {
  for (const path of ["/dashboard", `/studio/lang/${E2E_LANGUAGES.public}`, `/studio/lang/${E2E_LANGUAGES.private}/dictionary`, "/admin"]) {
    test(path, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL("**/login")
      await expect(page.getByRole("heading", { level: 1, name: EN.auth.signInTitle })).toBeVisible()
    })
  }

  test("/settings", async ({ page }) => {
    await page.goto("/settings")
    await page.waitForURL("**/login")
    await expect(page.getByRole("heading", { level: 1, name: EN.auth.signInTitle })).toBeVisible()
  })
})

test.describe("signing out", () => {
  // JWT sessions: signing out clears this context's cookie only; the role's saved
  // session (and other specs using it) stay valid.
  signedInAs("stranger")

  test("the account menu is reachable at a laptop viewport (1280px)", async ({ page }) => {
    await page.goto("/browse")
    await expect(page.locator("header").getByRole("button", { name: /E2E Stranger/ })).toBeInViewport({ ratio: 1 })
  })

  test("sign out from the account menu ends the session", async ({ page, pageErrors }) => {
    // Wide enough for the whole navbar (see the 1280px test above).
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.goto("/browse")
    expect(await sessionEmail(page)).toBe(E2E_USERS.stranger.email)

    await page.locator("header").getByRole("button", { name: /E2E Stranger/ }).click()
    await page.getByRole("menuitem", { name: EN.nav.signOut }).click()

    await expect(page.locator("header").getByRole("link", { name: EN.common.signIn })).toBeVisible()
    expect(await sessionEmail(page)).toBeNull()
    await page.goto("/dashboard")
    await page.waitForURL("**/login")
    expectNoPageErrors(pageErrors)
  })
})
