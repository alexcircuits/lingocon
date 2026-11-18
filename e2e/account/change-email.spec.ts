import { test, expect, expectNoPageErrors, unique, type Page } from "../fixtures"
import { db } from "../db"
import { EN } from "../public/helpers"
import {
  cleanupScratch,
  createScratchUser,
  sessionEmail,
  signInThroughForm,
  submitLogin,
  type ScratchUser,
} from "../access/helpers"

/**
 * Changing the email address of an account (Settings → Account). The address only moves
 * after the link sent to the NEW mailbox is opened and confirmed. No email leaves the test
 * server, so the tests read the link's token from the database, as the mailbox owner would
 * read it from the email.
 */

test.afterEach(cleanupScratch)

const newAddress = () => `moved-${unique()}@e2e.test`

async function openAccountTab(page: Page, user: ScratchUser) {
  await signInThroughForm(page, user)
  await page.goto("/settings")
  await page.waitForLoadState("networkidle")
  await page.getByRole("tab", { name: "Account" }).click()
  await expect(page.getByRole("button", { name: "Change email" })).toBeEnabled()
}

async function requestChange(page: Page, newEmail: string, password: string) {
  await page.getByRole("button", { name: "Change email" }).click()
  await page.getByLabel("New email address").fill(newEmail)
  await page.getByLabel("Current password").fill(password)
  await page.getByRole("button", { name: "Send confirmation link" }).click()
}

/** The token of the link "emailed" to the new address, or null when none is pending. */
async function pendingToken(userId: string): Promise<string | null> {
  const row = await db().verificationToken.findFirst({
    where: { identifier: { startsWith: `email-change:${userId}:` } },
    select: { token: true },
  })
  return row?.token ?? null
}

const storedEmail = async (userId: string) =>
  (await db().user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email

test("change email: the account moves to the new address once the emailed link is confirmed", async ({ page, pageErrors }) => {
  const user = await createScratchUser()
  const newEmail = newAddress()
  await openAccountTab(page, user)

  await requestChange(page, newEmail, user.password)
  await expect(page.getByRole("status")).toContainText(newEmail)
  // Asking changes nothing yet.
  expect(await storedEmail(user.id)).toBe(user.email)

  const token = await pendingToken(user.id)
  expect(token).not.toBeNull()

  // Opening the link (as a mail scanner would) changes nothing either: it needs the button.
  await page.goto(`/confirm-email?token=${token}`)
  await expect(page.getByText(newEmail)).toBeVisible()
  expect(await storedEmail(user.id)).toBe(user.email)

  await page.getByRole("button", { name: "Confirm new email" }).click()
  await expect(page.getByText("Your email was changed")).toBeVisible()
  await expect.poll(() => storedEmail(user.id)).toBe(newEmail)
  // The signed-in browser's session follows without signing in again.
  await expect.poll(() => sessionEmail(page)).toBe(newEmail)

  await page.goto("/settings")
  await page.getByRole("tab", { name: "Account" }).click()
  await expect(page.getByText(newEmail)).toBeVisible()
  await expect(page.getByRole("status")).toHaveCount(0)

  // The link is spent.
  await page.goto(`/confirm-email?token=${token}`)
  await expect(page.getByText("This link is invalid or has expired")).toBeVisible()
  expectNoPageErrors(pageErrors)

  // Signing in: the old address no longer works, the new one does.
  await page.context().clearCookies()
  await submitLogin(page, user.email, user.password)
  await expect(page.getByText(EN.auth.invalidCredentials)).toBeVisible()
  await signInThroughForm(page, { email: newEmail, password: user.password })
  expect(await sessionEmail(page)).toBe(newEmail)
})

test("change email: a wrong current password is refused and no link is issued", async ({ page, pageErrors }) => {
  const user = await createScratchUser()
  await openAccountTab(page, user)

  await requestChange(page, newAddress(), `${user.password}-wrong`)

  await expect(page.getByText("Current password is incorrect.")).toBeVisible()
  expect(await pendingToken(user.id)).toBeNull()
  expect(await storedEmail(user.id)).toBe(user.email)
  expectNoPageErrors(pageErrors)
})

test("change email: an address that another account uses is refused", async ({ page, pageErrors }) => {
  const user = await createScratchUser()
  const other = await createScratchUser()
  await openAccountTab(page, user)

  await requestChange(page, other.email.toUpperCase(), user.password)

  await expect(page.getByText("That email is already used by another account.")).toBeVisible()
  expect(await pendingToken(user.id)).toBeNull()
  expectNoPageErrors(pageErrors)
})

test("change email: a cancelled request leaves the address alone and kills its link", async ({ page, pageErrors }) => {
  const user = await createScratchUser()
  const newEmail = newAddress()
  await openAccountTab(page, user)
  await requestChange(page, newEmail, user.password)
  await expect(page.getByRole("status")).toContainText(newEmail)
  const token = await pendingToken(user.id)

  await page.getByRole("button", { name: "Cancel request" }).click()
  await expect(page.getByRole("status")).toHaveCount(0)
  expect(await pendingToken(user.id)).toBeNull()

  // The pending request also survives a reload only while it exists.
  await page.reload()
  await page.getByRole("tab", { name: "Account" }).click()
  await expect(page.getByRole("button", { name: "Change email" })).toBeEnabled()
  await expect(page.getByRole("status")).toHaveCount(0)

  await page.goto(`/confirm-email?token=${token}`)
  await expect(page.getByText("This link is invalid or has expired")).toBeVisible()
  expect(await storedEmail(user.id)).toBe(user.email)
  expectNoPageErrors(pageErrors)
})

test("change email: the link works in a browser that is not signed in", async ({ page, browser, pageErrors }) => {
  const user = await createScratchUser()
  const newEmail = newAddress()
  await openAccountTab(page, user)
  await requestChange(page, newEmail, user.password)
  await expect(page.getByRole("status")).toContainText(newEmail)
  const token = await pendingToken(user.id)

  // The new mailbox is often read on another device.
  const elsewhere = await browser.newContext()
  try {
    const mailbox = await elsewhere.newPage()
    await mailbox.goto(`/confirm-email?token=${token}`)
    await mailbox.getByRole("button", { name: "Confirm new email" }).click()
    await expect(mailbox.getByText("Your email was changed")).toBeVisible()
    // Not signed in here, so the page offers to sign in rather than go back to settings.
    await expect(mailbox.getByRole("status").getByRole("link", { name: "Sign in" })).toBeVisible()
  } finally {
    await elsewhere.close()
  }
  await expect.poll(() => storedEmail(user.id)).toBe(newEmail)

  // The first browser's session still says the old address until settings notices and refreshes it.
  await page.goto("/settings")
  await page.getByRole("tab", { name: "Account" }).click()
  await expect(page.getByText(newEmail)).toBeVisible()
  // Settings asks the session to refresh, and asks again after 4 s if that was dropped.
  await expect.poll(() => sessionEmail(page), { timeout: 20_000 }).toBe(newEmail)
  expectNoPageErrors(pageErrors)
})
