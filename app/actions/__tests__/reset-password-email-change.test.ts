// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  consumePasswordResetToken: vi.fn(),
  cancelEmailChange: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: mocks.userUpdate } } }))
vi.mock("@/lib/tokens", () => ({
  consumePasswordResetToken: mocks.consumePasswordResetToken,
  cancelEmailChange: mocks.cancelEmailChange,
  generateVerificationToken: vi.fn(),
  generatePasswordResetToken: vi.fn(),
  consumeVerificationToken: vi.fn(),
}))
vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }))
vi.mock("@/auth", () => ({ signOut: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }) }))

import { __resetRateLimits } from "@/lib/rate-limit"
import { resetPassword } from "../user-auth"

beforeEach(() => {
  vi.clearAllMocks()
  __resetRateLimits()
  mocks.consumePasswordResetToken.mockResolvedValue("old@example.test")
  mocks.userUpdate.mockResolvedValue({ id: "user-1" })
})

describe("resetPassword and a pending email change", () => {
  it("cancels the pending change: whoever asked for it knew the old password", async () => {
    // The owner's answer to "someone requested an email change" is to reset the password
    // through their mailbox. That must also stop the link already sent to the other address.
    await expect(resetPassword("reset-token", "a brand new password")).resolves.toEqual({ success: true })

    expect(mocks.cancelEmailChange).toHaveBeenCalledWith("user-1")
  })

  it("cancels nothing when the reset link is not valid", async () => {
    mocks.consumePasswordResetToken.mockResolvedValue(null)

    await expect(resetPassword("bad-token", "a brand new password")).resolves.toMatchObject({ error: expect.any(String) })
    expect(mocks.cancelEmailChange).not.toHaveBeenCalled()
  })
})
