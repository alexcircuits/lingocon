import { test as setup, expect } from "@playwright/test"
import { E2E_PASSWORD, E2E_USERS, SIGNED_IN_ROLES, authFile } from "./data"

/**
 * Signs every fixture role in through the real /login form (Credentials provider,
 * bcrypt, verified email) once, and saves the session cookies for the specs.
 * Requires e2e/seed.ts to have run against the server's database.
 */
for (const role of SIGNED_IN_ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/login")
    await page.locator("#email").fill(E2E_USERS[role].email)
    await page.locator("#password").fill(E2E_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL("**/dashboard", { timeout: 30_000 })
    const session = await page.request.get("/api/auth/session")
    expect(await session.json()).toMatchObject({ user: { email: E2E_USERS[role].email } })
    await page.context().storageState({ path: authFile(role) })
  })
}
