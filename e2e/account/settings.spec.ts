import { createHash } from "crypto"
import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { db } from "../db"
import {
  cleanupScratch,
  createScratchUser,
  expectLoginPage,
  isolateLoginRateLimit,
  privateLanguageId,
  scratchLanguageOwnedBy,
  sessionEmail,
  signInThroughForm,
  submitLogin,
  type ScratchUser,
} from "../access/helpers"

/**
 * Account settings: profile, password (there is no in-app "change password" — the
 * reset-link flow is the only way), browser-extension tokens and account-wide modules.
 * Everything that changes an account runs on a scratch user signed in inside the test.
 */

test.afterEach(cleanupScratch)

test("signed out: /settings sends the visitor to sign in", async ({ page, pageErrors }) => {
  await page.goto("/settings")
  await expectLoginPage(page)
  await page.goto("/settings/extension")
  await expectLoginPage(page)
  expectNoPageErrors(pageErrors)
})

/** Sign a scratch user in and open /settings once its session fetches have settled. */
async function openProfile(page: Page, user: ScratchUser) {
  await signInThroughForm(page, user)
  await page.goto("/settings")
  // Each session fetch resets the form (see "an unsaved display name survives…").
  await page.waitForLoadState("networkidle")
  const name = page.getByLabel("Display Name")
  await expect(name).toHaveValue(user.name)
  return name
}

test("profile: a new display name is saved and shown on the public profile", async ({ page, pageErrors }) => {
  const user = await createScratchUser({ name: "Before Rename" })
  const name = await openProfile(page, user)
  await name.fill("After Rename")
  await page.getByRole("button", { name: "Save Changes" }).click()
  await expect(page.getByText("Profile updated successfully")).toBeVisible()
  await expect
    .poll(async () => (await db().user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } })).name)
    .toBe("After Rename")

  await page.goto(`/users/${user.id}`)
  await expect(page.getByRole("heading", { name: "After Rename" }).first()).toBeVisible()
  await page.goto("/settings")
  await page.getByRole("tab", { name: "Account" }).click()
  await expect(page.getByText(user.email)).toBeVisible()
  expectNoPageErrors(pageErrors)
})

test("profile: after a rename, the settings form shows the new name on reload", async ({ page, pageErrors }) => {
  const user = await createScratchUser({ name: "Before Rename" })
  const name = await openProfile(page, user)
  await name.fill("After Rename")
  await page.getByRole("button", { name: "Save Changes" }).click()
  await expect(page.getByText("Profile updated successfully")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Display Name")).toHaveValue("After Rename")
  expectNoPageErrors(pageErrors)
})

test("profile: an unsaved display name survives a session refresh", async ({ page, pageErrors }) => {
  const user = await createScratchUser({ name: "Before Rename" })
  const name = await openProfile(page, user)
  await name.fill("Unsaved Name")
  // What the SessionProvider does when the tab becomes visible again.
  const refreshed = page.waitForResponse("**/api/auth/session")
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await refreshed
  await expect(name).toHaveValue("Unsaved Name")
  expectNoPageErrors(pageErrors)
})

test("password: reset through the emailed link, then only the new password signs in", async ({ page, browser, pageErrors }) => {
  const user = await createScratchUser()
  const newPassword = `Renewed-${user.password}`

  await isolateLoginRateLimit(page)
  await page.goto("/forgot-password")
  await page.locator("#email").fill(user.email)
  await page.getByRole("button", { name: "Send Reset Link" }).click()

  // The link the email would carry. The token is stored before the mail is sent; the
  // E2E server has no RESEND_API_KEY, so the form's own outcome depends on the network.
  const tokenWhere = { identifier: `pwd-reset:${user.email}` }
  await expect.poll(() => db().verificationToken.count({ where: tokenWhere })).toBe(1)
  const token = await db().verificationToken.findFirstOrThrow({ where: tokenWhere, select: { token: true } })
  await page.goto(`/reset-password?token=${token.token}`)
  await page.locator("#password").fill(newPassword)
  await page.locator("#confirm-password").fill(newPassword)
  await page.getByRole("button", { name: "Reset Password" }).click()
  await expect(page.getByText("Password reset successfully!")).toBeVisible()
  // The link is single-use.
  expect(await db().verificationToken.count({ where: { token: token.token } })).toBe(0)

  const context = await browser.newContext()
  try {
    const fresh = await context.newPage()
    await submitLogin(fresh, user.email, user.password)
    await expect(fresh.getByText("Invalid email or password")).toBeVisible()
    expect(await sessionEmail(fresh)).toBeNull()

    await signInThroughForm(fresh, { email: user.email, password: newPassword })
    expect(await sessionEmail(fresh)).toBe(user.email)
  } finally {
    await context.close()
  }
  expectNoPageErrors(pageErrors)
})

test("extension token: shown once, works as a bearer token, and can be revoked", async ({ page, pageErrors }) => {
  const user = await createScratchUser()
  await scratchLanguageOwnedBy(user.id)
  await signInThroughForm(page, user)

  await page.goto("/settings/extension")
  await expect(page.getByRole("heading", { level: 1, name: "Browser Extension" })).toBeVisible()
  await expect(page.getByText("No active tokens. Generate one to connect the extension.")).toBeVisible()
  await page.getByRole("button", { name: "New token" }).click()
  await expect(page.getByText("Your new token")).toBeVisible()
  const raw = (await page.locator(".font-mono.select-all").innerText()).trim()
  expect(raw.length).toBeGreaterThan(20)

  // Stored hashed, never in clear.
  const row = await db().extensionToken.findFirstOrThrow({ where: { userId: user.id }, select: { tokenHash: true } })
  expect(row.tokenHash).toBe(createHash("sha256").update(raw).digest("hex"))
  expect(row.tokenHash).not.toContain(raw)

  const bearer = { Authorization: `Bearer ${raw}` }
  const languages = await page.request.get("/api/ext/languages", { headers: bearer })
  expect(languages.status()).toBe(200)
  // A token only reaches its owner's languages.
  const foreign = await page.request.get(`/api/ext/dictionary?languageId=${await privateLanguageId()}`, { headers: bearer })
  expect(foreign.status()).toBe(404)

  // Shown once: a reload lists the token but never prints it again.
  await page.reload()
  await expect(page.getByText("Your new token")).toHaveCount(0)
  await expect(page.getByText(raw)).toHaveCount(0)
  await expect(page.getByText("active", { exact: true })).toHaveCount(1)

  await page.getByRole("button", { name: "Revoke token" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click()
  await expect(page.getByText("Token revoked")).toBeVisible()
  await expect(page.getByText("No active tokens. Generate one to connect the extension.")).toBeVisible()
  expect((await page.request.get("/api/ext/languages", { headers: bearer })).status()).toBe(401)
  expectNoPageErrors(pageErrors)
})

test.describe("stranger", () => {
  signedInAs("stranger")

  test("/settings/modules renders", async ({ page, pageErrors }) => {
    await page.goto("/settings/modules")
    await expect(page.getByRole("heading", { level: 1, name: "Account-wide modules" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("/settings shows the signed-in account", async ({ page, pageErrors }) => {
    await page.goto("/settings")
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible()
    await expect(page.getByLabel("Display Name")).toHaveValue("E2E Stranger")
    await page.getByRole("tab", { name: "Account" }).click()
    await expect(page.getByText("stranger@e2e.test")).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
