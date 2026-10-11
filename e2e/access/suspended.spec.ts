import { test, expect, expectNoPageErrors } from "../fixtures"
import { db } from "../db"
import {
  cleanupScratch,
  createScratchUser,
  expectLoginPage,
  scratchLanguageOwnedBy,
  sessionEmail,
  signInThroughForm,
  submitLogin,
} from "./helpers"

/**
 * A suspended account is treated as signed out. `getUserId()` (studio, Server Actions,
 * API routes) returns null for it; these specs also check the sign-in itself and the
 * pages that read the session directly. Scratch accounts only — the fixture users'
 * sessions are shared with the other suites.
 */

test.afterEach(cleanupScratch)

test("a suspended account cannot sign in", async ({ page }) => {
  const user = await createScratchUser({ suspended: true })
  await submitLogin(page, user.email, user.password)
  await expect(page.getByText("Invalid email or password")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
  expect(await sessionEmail(page)).toBeNull()
})

test("a session stops authorizing studio, actions and APIs once the account is suspended", async ({ page, pageErrors }) => {
  const user = await createScratchUser()
  const language = await scratchLanguageOwnedBy(user.id, { visibility: "PRIVATE" })
  await signInThroughForm(page, user)

  await page.goto(`/studio/lang/${language.slug}/dictionary`)
  await expect(page.getByRole("heading", { level: 1, name: "Dictionary" })).toBeVisible()
  expect((await page.request.get("/api/ext/tokens")).status()).toBe(200)

  await db().user.update({ where: { id: user.id }, data: { isSuspended: true, suspendedAt: new Date() } })

  await page.goto(`/studio/lang/${language.slug}/dictionary`)
  await expectLoginPage(page)
  expect((await page.request.get("/api/ext/tokens")).status()).toBe(401)
  expect((await page.request.post("/api/ext/token", { data: { name: "after suspension" } })).status()).toBe(401)
  expect(await db().extensionToken.count({ where: { userId: user.id } })).toBe(0)
  expectNoPageErrors(pageErrors)
})

test("pages that read the session directly also treat a suspended account as signed out", async ({ page }) => {
  const user = await createScratchUser()
  await signInThroughForm(page, user)
  await db().user.update({ where: { id: user.id }, data: { isSuspended: true, suspendedAt: new Date() } })

  await page.goto("/dashboard")
  await expectLoginPage(page)
  await page.goto("/favorites")
  await expectLoginPage(page)
})
