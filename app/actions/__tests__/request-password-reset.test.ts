// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  generatePasswordResetToken: vi.fn(),
  cancelPasswordReset: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.userFindFirst } } }))
vi.mock("@/lib/tokens", () => ({
  generatePasswordResetToken: mocks.generatePasswordResetToken,
  cancelPasswordReset: mocks.cancelPasswordReset,
  consumePasswordResetToken: vi.fn(),
  cancelEmailChange: vi.fn(),
  generateVerificationToken: vi.fn(),
  consumeVerificationToken: vi.fn(),
}))
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}))
vi.mock("@/auth", () => ({ signOut: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }) }))

import { __resetRateLimits } from "@/lib/rate-limit"
import { requestPasswordReset } from "../user-auth"

const EMAIL = "owner@proton.test"
const DAY_MS = 24 * 60 * 60_000

function account(fields: { password: string | null; emailVerified: Date | null }) {
  return { id: "user-1", email: EMAIL, ...fields }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetRateLimits()
  mocks.generatePasswordResetToken.mockResolvedValue({ token: "reset-token", isNew: true })
  mocks.sendPasswordResetEmail.mockResolvedValue(undefined)
})

describe("requestPasswordReset", () => {
  it("sends a link to an account with a password", async () => {
    mocks.userFindFirst.mockResolvedValue(account({ password: "hash", emailVerified: new Date() }))

    await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ success: true })
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(EMAIL, "reset-token")
  })

  it("sends a link to a Google-only account whose address was confirmed days ago", async () => {
    // A Google account that moved to another address, then lost Google sign-in, had no way
    // back in: the reset flow ignored it and the confirmed mailbox was the only proof left.
    mocks.userFindFirst.mockResolvedValue(account({ password: null, emailVerified: new Date(Date.now() - 4 * DAY_MS) }))

    await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ success: true })
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(EMAIL, "reset-token")
  })

  it("sends nothing to a passwordless account whose address changed moments ago", async () => {
    // Moving a passwordless account needs no password: a borrowed session must not be able
    // to move it to its own mailbox and immediately give itself a password as well.
    mocks.userFindFirst.mockResolvedValue(account({ password: null, emailVerified: new Date(Date.now() - 60_000) }))

    await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ success: true })
    expect(mocks.generatePasswordResetToken).not.toHaveBeenCalled()
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("sends nothing to a passwordless account whose address was never confirmed", async () => {
    mocks.userFindFirst.mockResolvedValue(account({ password: null, emailVerified: null }))

    await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ success: true })
    expect(mocks.generatePasswordResetToken).not.toHaveBeenCalled()
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("drops the link when the email could not be sent, so asking again sends a new one", async () => {
    mocks.userFindFirst.mockResolvedValue(account({ password: "hash", emailVerified: new Date() }))
    mocks.sendPasswordResetEmail.mockRejectedValue(new Error("provider refused"))
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    // Same answer as for an unknown address: the form must not reveal which accounts exist.
    await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ success: true })
    expect(mocks.cancelPasswordReset).toHaveBeenCalledWith(EMAIL)
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it("still gives the unknown-address answer when dropping the unsent link fails too", async () => {
    mocks.userFindFirst.mockResolvedValue(account({ password: "hash", emailVerified: new Date() }))
    mocks.sendPasswordResetEmail.mockRejectedValue(new Error("provider refused"))
    mocks.cancelPasswordReset.mockRejectedValue(new Error("database unavailable"))
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(requestPasswordReset(EMAIL)).resolves.toEqual({ success: true })
    logged.mockRestore()
  })
})
