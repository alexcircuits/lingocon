import bcrypt from "bcryptjs"
import { randomUUID } from "node:crypto"
import { test, expect, expectNoPageErrors } from "../fixtures"
import { db } from "../db"
import { EN } from "../public/helpers"
import {
  createScratchUser,
  deleteScratchUsers,
  insertPasswordResetToken,
  scratchEmail,
  sessionEmail,
  submitLogin,
  useOwnClientIp,
  type ScratchUser,
} from "./helpers"

/**
 * Account lifecycle on scratch users: registration, email verification and password reset.
 * Tokens are read from / inserted into the database (lib/tokens.ts: verification tokens use
 * the email as identifier, reset tokens `pwd-reset:<email>`) — no mail is delivered in E2E.
 */

test.describe("account flows", () => {
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

  test("registration creates an unverified account and leads to the verify page", async ({ page, pageErrors }) => {
    const email = scratchEmail("register")
    scratchEmails.push(email)
    const password = `Register-${randomUUID().slice(0, 8)}`

    await page.goto("/register")
    await page.getByLabel("Name").fill("E2E Registrant")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: EN.auth.createAccountButton }).click()

    await page.waitForURL("**/verify-email")
    await expect(page.getByText(EN.auth.accountCreated)).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: EN.auth.verifyTitle })).toBeVisible()

    const user = await db().user.findUniqueOrThrow({ where: { email }, select: { name: true, emailVerified: true, password: true } })
    expect(user.name).toBe("E2E Registrant")
    expect(user.emailVerified).toBeNull()
    expect(user.password).not.toBe(password)
    expect(await bcrypt.compare(password, user.password!)).toBe(true)
    expect(await db().verificationToken.count({ where: { identifier: email } })).toBe(1)
    // Registering does not sign the new user in.
    expect(await sessionEmail(page)).toBeNull()
    expectNoPageErrors(pageErrors)
  })

  test("registering an existing email is refused", async ({ page }) => {
    const existing = await scratchUser()
    await page.goto("/register")
    await page.getByLabel("Name").fill("Someone Else")
    await page.getByLabel("Email").fill(existing.email.toUpperCase())
    await page.getByLabel("Password").fill("Another-pass-123")
    await page.getByRole("button", { name: EN.auth.createAccountButton }).click()
    await expect(page.getByText("User with this email already exists")).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test("the emailed verification link verifies the account", async ({ page }) => {
    const user = await scratchUser({ verified: false })
    const token = randomUUID()
    await db().verificationToken.create({
      data: { identifier: user.email, token, expires: new Date(Date.now() + 60 * 60_000) },
    })

    await page.goto(`/verify-email?token=${token}`)
    await expect(page.getByText(EN.auth.emailVerified)).toBeVisible()
    await expect(page.getByRole("link", { name: EN.auth.signInButton, exact: true })).toHaveAttribute("href", "/login")
    const row = await db().user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerified: true } })
    expect(row.emailVerified).not.toBeNull()
    expect(await db().verificationToken.count({ where: { token } })).toBe(0)
  })

  test("forgot-password answers the same way whether or not the account exists", async ({ page, pageErrors }) => {
    const user = await scratchUser()
    const unknown = scratchEmail("nobody")

    async function requestReset(email: string): Promise<string> {
      await page.goto("/forgot-password")
      await page.getByLabel("Email").fill(email)
      await page.getByRole("button", { name: EN.auth.sendResetLink }).click()
      await expect(page.getByText(EN.auth.forgotCheckEmail)).toBeVisible()
      const confirmation = await page.getByText(/If an account exists with/).innerText()
      return confirmation.replace(email, "<email>")
    }

    const forKnown = await requestReset(user.email)
    const forUnknown = await requestReset(unknown)
    expect(forKnown).toBe(forUnknown)
    expect(forKnown).toBe("If an account exists with <email>, we've sent a password reset link.")

    // Only the real account got a reset token.
    expect(await db().verificationToken.count({ where: { identifier: `pwd-reset:${user.email}` } })).toBe(1)
    expect(await db().verificationToken.count({ where: { identifier: `pwd-reset:${unknown}` } })).toBe(0)
    expectNoPageErrors(pageErrors)
  })

  test("a reset link sets a new password that then signs in", async ({ page }) => {
    const user = await scratchUser()
    const token = await insertPasswordResetToken(user.email)
    const newPassword = `Reset-${randomUUID().slice(0, 8)}`

    await page.goto(`/reset-password?token=${token}`)
    await expect(page.getByRole("heading", { level: 1, name: EN.auth.resetTitle })).toBeVisible()
    await page.getByLabel(EN.auth.newPasswordLabel).fill(newPassword)
    await page.getByLabel(EN.auth.confirmPasswordLabel).fill(newPassword)
    await page.getByRole("button", { name: EN.auth.resetPasswordButton }).click()
    await expect(page.getByText(EN.auth.passwordResetSuccess)).toBeVisible()

    // The token is single-use and the stored hash changed.
    expect(await db().verificationToken.count({ where: { token } })).toBe(0)
    const row = await db().user.findUniqueOrThrow({ where: { id: user.id }, select: { password: true } })
    expect(await bcrypt.compare(newPassword, row.password!)).toBe(true)
    expect(await bcrypt.compare(user.password, row.password!)).toBe(false)

    await submitLogin(page, user.email, newPassword)
    await page.waitForURL("**/dashboard")
    expect(await sessionEmail(page)).toBe(user.email)
  })

  test("an unknown reset token is rejected and the password is unchanged", async ({ page }) => {
    const user = await scratchUser()
    await page.goto(`/reset-password?token=${randomUUID()}`)
    await page.getByLabel(EN.auth.newPasswordLabel).fill("Brand-new-pass-1")
    await page.getByLabel(EN.auth.confirmPasswordLabel).fill("Brand-new-pass-1")
    await page.getByRole("button", { name: EN.auth.resetPasswordButton }).click()
    await expect(page.getByText("Invalid or expired reset link. Please request a new one.")).toBeVisible()
    const row = await db().user.findUniqueOrThrow({ where: { id: user.id }, select: { password: true } })
    expect(await bcrypt.compare(user.password, row.password!)).toBe(true)
  })

  test("the reset form checks that both passwords match before submitting", async ({ page }) => {
    await page.goto(`/reset-password?token=${randomUUID()}`)
    await page.getByLabel(EN.auth.newPasswordLabel).fill("Brand-new-pass-1")
    await page.getByLabel(EN.auth.confirmPasswordLabel).fill("Brand-new-pass-2")
    await page.getByRole("button", { name: EN.auth.resetPasswordButton }).click()
    await expect(page.getByText(EN.auth.passwordsNoMatch)).toBeVisible()
  })
})
