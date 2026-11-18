// @vitest-environment node
import bcrypt from "bcryptjs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  tokenDeleteMany: vi.fn(),
  generateEmailChangeToken: vi.fn(),
  consumeEmailChangeToken: vi.fn(),
  peekEmailChangeToken: vi.fn(),
  getPendingEmailChange: vi.fn(),
  cancelEmailChange: vi.fn(),
  sendEmailChangeConfirmation: vi.fn(),
  sendEmailChangedNotice: vi.fn(),
  sendEmailChangeRequestedNotice: vi.fn(),
  refreshSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    verificationToken: { deleteMany: mocks.tokenDeleteMany },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}))
vi.mock("@/lib/auth-helpers", () => ({ getUserId: mocks.getUserId }))
vi.mock("@/lib/tokens", () => ({
  generateEmailChangeToken: mocks.generateEmailChangeToken,
  consumeEmailChangeToken: mocks.consumeEmailChangeToken,
  peekEmailChangeToken: mocks.peekEmailChangeToken,
  getPendingEmailChange: mocks.getPendingEmailChange,
  cancelEmailChange: mocks.cancelEmailChange,
}))
vi.mock("@/lib/email", () => ({
  sendEmailChangeConfirmation: mocks.sendEmailChangeConfirmation,
  sendEmailChangedNotice: mocks.sendEmailChangedNotice,
  sendEmailChangeRequestedNotice: mocks.sendEmailChangeRequestedNotice,
}))
vi.mock("@/auth", () => ({ unstable_update: mocks.refreshSession }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }) }))

import { __resetRateLimits } from "@/lib/rate-limit"
import {
  cancelPendingEmailChange,
  confirmEmailChange,
  getEmailSettings,
  previewEmailChange,
  requestEmailChange,
} from "../email-change"

const PASSWORD = "correct horse battery"
const passwordHash = bcrypt.hashSync(PASSWORD, 4)

/** The signed-in account as the database returns it. */
function account(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "old@example.test",
    password: passwordHash,
    accounts: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetRateLimits()
  mocks.getUserId.mockResolvedValue("user-1")
  mocks.userFindUnique.mockResolvedValue(account())
  mocks.userFindFirst.mockResolvedValue(null)
  mocks.userUpdate.mockResolvedValue({})
  mocks.tokenDeleteMany.mockResolvedValue({ count: 0 })
  mocks.generateEmailChangeToken.mockResolvedValue({ token: "tok-1", isNew: true })
  mocks.getPendingEmailChange.mockResolvedValue(null)
  mocks.refreshSession.mockResolvedValue(null)
})

describe("requestEmailChange", () => {
  it("sends a confirmation link to the new address and leaves the account as it is", async () => {
    const result = await requestEmailChange({ newEmail: "  New@Example.test ", currentPassword: PASSWORD })

    expect(result).toEqual({ success: true, pendingEmail: "new@example.test" })
    expect(mocks.generateEmailChangeToken).toHaveBeenCalledWith("user-1", "new@example.test")
    expect(mocks.sendEmailChangeConfirmation).toHaveBeenCalledWith("new@example.test", "tok-1")
    expect(mocks.userUpdate).not.toHaveBeenCalled()
    expect(mocks.sendEmailChangedNotice).not.toHaveBeenCalled()
  })

  it("warns the current address that a change was asked for, so its owner can stop it", async () => {
    await requestEmailChange({ newEmail: "new@example.test", currentPassword: PASSWORD })

    expect(mocks.sendEmailChangeRequestedNotice).toHaveBeenCalledWith("old@example.test", "new@example.test")
  })

  it("still issues the link when that warning cannot be sent", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.sendEmailChangeRequestedNotice.mockRejectedValue(new Error("mail provider down"))

    await expect(requestEmailChange({ newEmail: "new@example.test", currentPassword: PASSWORD })).resolves.toMatchObject({
      success: true,
    })
    logged.mockRestore()
  })

  it("has nobody to warn on an account without an address", async () => {
    mocks.userFindUnique.mockResolvedValue(account({ email: null, password: null }))

    await expect(requestEmailChange({ newEmail: "new@example.test" })).resolves.toMatchObject({ success: true })
    expect(mocks.sendEmailChangeRequestedNotice).not.toHaveBeenCalled()
  })

  it("is refused when signed out", async () => {
    mocks.getUserId.mockResolvedValue(null)

    await expect(requestEmailChange({ newEmail: "new@example.test", currentPassword: PASSWORD })).resolves.toEqual({
      error: "Unauthorized",
    })
    expect(mocks.generateEmailChangeToken).not.toHaveBeenCalled()
  })

  it("needs the current password on an account that has one", async () => {
    await expect(requestEmailChange({ newEmail: "new@example.test" })).resolves.toEqual({
      error: "Enter your current password to change your email.",
    })
    await expect(requestEmailChange({ newEmail: "new@example.test", currentPassword: "wrong password" })).resolves.toEqual({
      error: "Current password is incorrect.",
    })
    expect(mocks.generateEmailChangeToken).not.toHaveBeenCalled()
    expect(mocks.sendEmailChangeConfirmation).not.toHaveBeenCalled()
  })

  it("asks for no password on an account that signs in with Google or GitHub only", async () => {
    mocks.userFindUnique.mockResolvedValue(account({ password: null, accounts: [{ provider: "google" }] }))

    await expect(requestEmailChange({ newEmail: "new@example.test" })).resolves.toMatchObject({ success: true })
    expect(mocks.sendEmailChangeConfirmation).toHaveBeenCalledWith("new@example.test", "tok-1")
  })

  it("rejects something that is not an email address", async () => {
    await expect(requestEmailChange({ newEmail: "not-an-email", currentPassword: PASSWORD })).resolves.toEqual({
      error: "Enter a valid email address.",
    })
    expect(mocks.generateEmailChangeToken).not.toHaveBeenCalled()
  })

  it("rejects the address the account already has, however it is capitalised", async () => {
    mocks.userFindUnique.mockResolvedValue(account({ email: "Old@Example.test" }))

    await expect(requestEmailChange({ newEmail: "old@example.TEST", currentPassword: PASSWORD })).resolves.toEqual({
      error: "That is already your email address.",
    })
    expect(mocks.generateEmailChangeToken).not.toHaveBeenCalled()
  })

  it("rejects an address another account uses, without sending anything", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "user-2" })

    await expect(requestEmailChange({ newEmail: "taken@example.test", currentPassword: PASSWORD })).resolves.toEqual({
      error: "That email is already used by another account.",
    })
    expect(mocks.userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: "taken@example.test", mode: "insensitive" } } }),
    )
    expect(mocks.sendEmailChangeConfirmation).not.toHaveBeenCalled()
  })

  it("does not send a second email when the link was issued moments ago", async () => {
    mocks.generateEmailChangeToken.mockResolvedValue({ token: "tok-1", isNew: false })

    await expect(requestEmailChange({ newEmail: "new@example.test", currentPassword: PASSWORD })).resolves.toMatchObject({
      success: true,
    })
    expect(mocks.sendEmailChangeConfirmation).not.toHaveBeenCalled()
    expect(mocks.sendEmailChangeRequestedNotice).not.toHaveBeenCalled()
  })

  it("stops after five attempts an hour, so the password cannot be guessed through it", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestEmailChange({ newEmail: "new@example.test", currentPassword: "wrong password" })
    }

    await expect(requestEmailChange({ newEmail: "new@example.test", currentPassword: PASSWORD })).resolves.toEqual({
      error: "Too many attempts. Please wait a few minutes and try again.",
    })
    expect(mocks.generateEmailChangeToken).not.toHaveBeenCalled()
  })

  it("reports a failure to send instead of pretending the link is on its way", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.sendEmailChangeConfirmation.mockRejectedValue(new Error("mail provider down"))

    await expect(requestEmailChange({ newEmail: "new@example.test", currentPassword: PASSWORD })).resolves.toEqual({
      error: "We could not send the confirmation email. Please try again.",
    })
    expect(mocks.cancelEmailChange).toHaveBeenCalledWith("user-1")
    logged.mockRestore()
  })
})

describe("confirmEmailChange", () => {
  beforeEach(() => {
    mocks.consumeEmailChangeToken.mockResolvedValue({ userId: "user-1", newEmail: "new@example.test" })
    mocks.getUserId.mockResolvedValue(null)
  })

  it("switches the account to the new, now verified, address", async () => {
    const before = Date.now()

    await expect(confirmEmailChange("tok-1")).resolves.toEqual({ success: true, email: "new@example.test" })

    expect(mocks.userUpdate).toHaveBeenCalledTimes(1)
    const update = mocks.userUpdate.mock.calls[0][0]
    expect(update.where).toEqual({ id: "user-1" })
    expect(update.data.email).toBe("new@example.test")
    expect(update.data.emailVerified.getTime()).toBeGreaterThanOrEqual(before)
  })

  it("cancels sign-up and password-reset links that were sent to the old address", async () => {
    await confirmEmailChange("tok-1")

    expect(mocks.tokenDeleteMany).toHaveBeenCalledWith({
      where: { identifier: { in: ["old@example.test", "pwd-reset:old@example.test"] } },
    })
  })

  it("drops every other pending request of the account, so an older link cannot move it again", async () => {
    await confirmEmailChange("tok-1")

    expect(mocks.cancelEmailChange).toHaveBeenCalledWith("user-1")
  })

  it("refuses a suspended account", async () => {
    mocks.userFindUnique.mockResolvedValue(account({ isSuspended: true }))

    await expect(confirmEmailChange("tok-1")).resolves.toMatchObject({ error: expect.stringContaining("invalid") })
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it("says to ask again when it fails after the link was used up", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.userUpdate.mockRejectedValue(new Error("database unavailable"))

    await expect(confirmEmailChange("tok-1")).resolves.toEqual({
      error: "Something went wrong and this link can no longer be used. Request the change again from your settings.",
    })
    logged.mockRestore()
  })

  it("tells the old address that the email was changed", async () => {
    await confirmEmailChange("tok-1")

    expect(mocks.sendEmailChangedNotice).toHaveBeenCalledWith("old@example.test", "new@example.test")
  })

  it("still succeeds when the notice to the old address cannot be sent", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.sendEmailChangedNotice.mockRejectedValue(new Error("mail provider down"))

    await expect(confirmEmailChange("tok-1")).resolves.toEqual({ success: true, email: "new@example.test" })
    logged.mockRestore()
  })

  it("works for an account that had no email before, with nobody to notify", async () => {
    mocks.userFindUnique.mockResolvedValue(account({ email: null, password: null }))

    await expect(confirmEmailChange("tok-1")).resolves.toEqual({ success: true, email: "new@example.test" })
    expect(mocks.sendEmailChangedNotice).not.toHaveBeenCalled()
    expect(mocks.tokenDeleteMany).not.toHaveBeenCalled()
  })

  it("rejects a link that is invalid, expired or already used", async () => {
    mocks.consumeEmailChangeToken.mockResolvedValue(null)

    await expect(confirmEmailChange("nope")).resolves.toEqual({
      error: "This link is invalid or has expired. Request the change again from your settings.",
    })
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it("rejects a link without a token before looking anything up", async () => {
    await expect(confirmEmailChange("")).resolves.toMatchObject({ error: expect.stringContaining("invalid") })
    expect(mocks.consumeEmailChangeToken).not.toHaveBeenCalled()
  })

  it("does not take an address that another account claimed in the meantime", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "user-2" })

    await expect(confirmEmailChange("tok-1")).resolves.toEqual({
      error: "That email is already used by another account.",
    })
    expect(mocks.userUpdate).not.toHaveBeenCalled()
    expect(mocks.sendEmailChangedNotice).not.toHaveBeenCalled()
  })

  it("reports the same when the database refuses the address as a duplicate", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.userUpdate.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))

    await expect(confirmEmailChange("tok-1")).resolves.toEqual({
      error: "That email is already used by another account.",
    })
    logged.mockRestore()
  })

  it("fails cleanly when the account no longer exists", async () => {
    mocks.userFindUnique.mockResolvedValue(null)

    await expect(confirmEmailChange("tok-1")).resolves.toMatchObject({ error: expect.stringContaining("invalid") })
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it("refreshes the session only in a browser signed in to that same account", async () => {
    await confirmEmailChange("tok-1")
    expect(mocks.refreshSession).not.toHaveBeenCalled()

    mocks.getUserId.mockResolvedValue("someone-else")
    mocks.consumeEmailChangeToken.mockResolvedValue({ userId: "user-1", newEmail: "new@example.test" })
    await confirmEmailChange("tok-1")
    expect(mocks.refreshSession).not.toHaveBeenCalled()

    mocks.getUserId.mockResolvedValue("user-1")
    await confirmEmailChange("tok-1")
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
  })
})

describe("previewEmailChange", () => {
  it("shows which address a link is for, without using it up", async () => {
    mocks.peekEmailChangeToken.mockResolvedValue({ userId: "user-1", newEmail: "new@example.test" })

    await expect(previewEmailChange("tok-1")).resolves.toEqual({ newEmail: "new@example.test", otherAccount: false })
    expect(mocks.consumeEmailChangeToken).not.toHaveBeenCalled()
  })

  it("flags a link that belongs to another account than the one signed in here", async () => {
    mocks.peekEmailChangeToken.mockResolvedValue({ userId: "user-1", newEmail: "new@example.test" })

    mocks.getUserId.mockResolvedValue("someone-else")
    await expect(previewEmailChange("tok-1")).resolves.toEqual({ newEmail: "new@example.test", otherAccount: true })

    // Signed out is not "another account": the link is often opened on another device.
    mocks.getUserId.mockResolvedValue(null)
    await expect(previewEmailChange("tok-1")).resolves.toEqual({ newEmail: "new@example.test", otherAccount: false })
  })

  it("says so when the link is no longer good", async () => {
    mocks.peekEmailChangeToken.mockResolvedValue(null)

    await expect(previewEmailChange("tok-1")).resolves.toMatchObject({ error: expect.stringContaining("invalid") })
  })
})

describe("getEmailSettings and cancelPendingEmailChange", () => {
  it("describes the account: address, password or not, sign-in providers, pending change", async () => {
    mocks.userFindUnique.mockResolvedValue(account({ accounts: [{ provider: "github" }, { provider: "google" }] }))
    mocks.getPendingEmailChange.mockResolvedValue("new@example.test")

    await expect(getEmailSettings()).resolves.toEqual({
      email: "old@example.test",
      hasPassword: true,
      providers: ["github", "google"],
      pendingEmail: "new@example.test",
    })
  })

  it("never returns the password hash", async () => {
    const settings = await getEmailSettings()
    expect(JSON.stringify(settings)).not.toContain(passwordHash)
  })

  it("is refused when signed out", async () => {
    mocks.getUserId.mockResolvedValue(null)

    await expect(getEmailSettings()).resolves.toEqual({ error: "Unauthorized" })
    await expect(cancelPendingEmailChange()).resolves.toEqual({ error: "Unauthorized" })
    expect(mocks.cancelEmailChange).not.toHaveBeenCalled()
  })

  it("cancels the pending change of the signed-in account", async () => {
    await expect(cancelPendingEmailChange()).resolves.toEqual({ success: true })
    expect(mocks.cancelEmailChange).toHaveBeenCalledWith("user-1")
  })
})
