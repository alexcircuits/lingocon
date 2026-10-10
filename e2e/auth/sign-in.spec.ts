import { test, expect, expectNoPageErrors } from "../fixtures"
import { E2E_PASSWORD, E2E_USERS } from "../data"
import { EN } from "../public/helpers"
import { createScratchUser, deleteScratchUsers, sessionEmail, submitLogin, useOwnClientIp, type ScratchUser } from "./helpers"

/**
 * The real /login form (Auth.js Credentials provider). Each test makes at most one
 * sign-in attempt, from its own client IP (see useOwnClientIp), so the suite stays far
 * below the 30-per-15-minutes login limit and the per-account limit of 10.
 */
test.describe("sign in", () => {
  const scratchEmails: string[] = []

  test.beforeEach(async ({ page }) => {
    await useOwnClientIp(page)
  })

  test.afterAll(async () => {
    await deleteScratchUsers(scratchEmails)
  })

  async function scratchUser(options: { verified?: boolean } = {}): Promise<ScratchUser> {
    const user = await createScratchUser(options)
    scratchEmails.push(user.email)
    return user
  }

  test("the owner signs in through the form and lands on the dashboard", async ({ page, pageErrors }) => {
    await submitLogin(page, E2E_USERS.owner.email, E2E_PASSWORD)
    await page.waitForURL("**/dashboard")
    await expect(page.getByText(EN.auth.loggedIn)).toBeVisible()
    // A fresh browser has not seen the onboarding tour yet: it opens over the dashboard.
    const tour = page.getByRole("dialog", { name: "Welcome to LingoCon!" })
    await tour.getByRole("button", { name: "Skip Tour" }).click()
    await expect(tour).toBeHidden()
    await expect(page.getByRole("heading", { level: 1, name: "E2E" })).toBeVisible()
    await expect(page.getByRole("main").getByText("E2E Public Tongue").first()).toBeVisible()
    expect(await sessionEmail(page)).toBe(E2E_USERS.owner.email)
    expectNoPageErrors(pageErrors)
  })

  test("a wrong password shows an error and stays on /login", async ({ page, pageErrors }) => {
    const user = await scratchUser()
    await submitLogin(page, user.email, `${user.password}-wrong`)
    await expect(page.getByText(EN.auth.invalidCredentials)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel("Password")).toBeVisible()
    expect(await sessionEmail(page)).toBeNull()
    expectNoPageErrors(pageErrors)
  })

  test("an unknown email gets the same error as a wrong password", async ({ page }) => {
    await submitLogin(page, `nobody-${Date.now()}@e2e.test`, "Some-password-123")
    await expect(page.getByText(EN.auth.invalidCredentials)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    expect(await sessionEmail(page)).toBeNull()
  })

  test("an unverified account is sent to verify its email and gets no session", async ({ page }) => {
    const user = await scratchUser({ verified: false })
    await submitLogin(page, user.email, user.password)
    await page.waitForURL("**/verify-email")
    await expect(page.getByText(EN.auth.verifyEmailFirst)).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: EN.auth.verifyTitle })).toBeVisible()
    expect(await sessionEmail(page)).toBeNull()
  })

  test("a suspended account cannot get a session", async ({ page }) => {
    await submitLogin(page, E2E_USERS.suspended.email, E2E_PASSWORD)
    await expect(page.getByText(EN.auth.invalidCredentials)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    expect(await sessionEmail(page)).toBeNull()
    await page.goto("/dashboard")
    await page.waitForURL("**/login")
  })
})
