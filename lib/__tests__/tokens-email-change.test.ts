// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

type Row = { identifier: string; token: string; expires: Date }

/** A tiny in-memory stand-in for the `verification_tokens` table. */
const table = vi.hoisted(() => ({ rows: [] as { identifier: string; token: string; expires: Date }[] }))

vi.mock("@/lib/prisma", () => {
  const matches = (row: Row, where: Record<string, unknown> = {}) => {
    const { identifier, token } = where as { identifier?: string | { startsWith?: string; in?: string[] }; token?: string }
    if (token !== undefined && row.token !== token) return false
    if (typeof identifier === "string" && row.identifier !== identifier) return false
    if (identifier && typeof identifier === "object") {
      if (identifier.startsWith !== undefined && !row.identifier.startsWith(identifier.startsWith)) return false
      if (identifier.in !== undefined && !identifier.in.includes(row.identifier)) return false
    }
    return true
  }
  return {
    prisma: {
      verificationToken: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => table.rows.find((row) => matches(row, where)) ?? null,
        findUnique: async ({ where }: { where: Record<string, unknown> }) => table.rows.find((row) => matches(row, where)) ?? null,
        create: async ({ data }: { data: Row }) => {
          table.rows.push(data)
          return data
        },
        delete: async ({ where }: { where: Record<string, unknown> }) => {
          table.rows = table.rows.filter((row) => !matches(row, where))
        },
        deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
          const before = table.rows.length
          table.rows = table.rows.filter((row) => !matches(row, where))
          return { count: before - table.rows.length }
        },
      },
    },
  }
})

import {
  cancelEmailChange,
  consumeEmailChangeToken,
  consumePasswordResetToken,
  consumeVerificationToken,
  generateEmailChangeToken,
  getPendingEmailChange,
  peekEmailChangeToken,
} from "@/lib/tokens"

const HOUR = 60 * 60 * 1000

beforeEach(() => {
  table.rows = []
  vi.useRealTimers()
})

describe("email change tokens", () => {
  it("remembers who asked and which address, for one hour", async () => {
    const before = Date.now()
    const { token, isNew } = await generateEmailChangeToken("user-1", "new@example.test")

    expect(isNew).toBe(true)
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0].identifier).toBe("email-change:user-1:new@example.test")
    expect(table.rows[0].expires.getTime() - before).toBeGreaterThan(HOUR - 5_000)
    expect(table.rows[0].expires.getTime() - before).toBeLessThanOrEqual(HOUR + 5_000)
    await expect(peekEmailChangeToken(token)).resolves.toEqual({ userId: "user-1", newEmail: "new@example.test" })
  })

  it("keeps only the latest request of a user, without touching other users", async () => {
    const first = await generateEmailChangeToken("user-1", "first@example.test")
    await generateEmailChangeToken("user-2", "other@example.test")
    const second = await generateEmailChangeToken("user-1", "second@example.test")

    await expect(peekEmailChangeToken(first.token)).resolves.toBeNull()
    await expect(peekEmailChangeToken(second.token)).resolves.toEqual({ userId: "user-1", newEmail: "second@example.test" })
    await expect(getPendingEmailChange("user-1")).resolves.toBe("second@example.test")
    await expect(getPendingEmailChange("user-2")).resolves.toBe("other@example.test")
  })

  it("does not issue a second link for the same address within two minutes", async () => {
    const first = await generateEmailChangeToken("user-1", "new@example.test")
    const again = await generateEmailChangeToken("user-1", "new@example.test")

    expect(again).toEqual({ token: first.token, isNew: false })
    expect(table.rows).toHaveLength(1)
  })

  it("hands the request back once, then the link is spent", async () => {
    const { token } = await generateEmailChangeToken("user-1", "new@example.test")

    await expect(consumeEmailChangeToken(token)).resolves.toEqual({ userId: "user-1", newEmail: "new@example.test" })
    await expect(consumeEmailChangeToken(token)).resolves.toBeNull()
    await expect(getPendingEmailChange("user-1")).resolves.toBeNull()
  })

  it("two confirmations racing on one link: only one gets the request", async () => {
    // A double click, or the same link open in two tabs.
    const { token } = await generateEmailChangeToken("user-1", "new@example.test")

    const results = await Promise.all([consumeEmailChangeToken(token), consumeEmailChangeToken(token)])

    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it("looking at a link does not spend it", async () => {
    const { token } = await generateEmailChangeToken("user-1", "new@example.test")

    await peekEmailChangeToken(token)
    await peekEmailChangeToken(token)

    await expect(consumeEmailChangeToken(token)).resolves.toEqual({ userId: "user-1", newEmail: "new@example.test" })
  })

  it("refuses an expired link and clears it", async () => {
    const { token } = await generateEmailChangeToken("user-1", "new@example.test")
    table.rows[0].expires = new Date(Date.now() - 1_000)

    await expect(peekEmailChangeToken(token)).resolves.toBeNull()
    await expect(consumeEmailChangeToken(token)).resolves.toBeNull()
    expect(table.rows).toHaveLength(0)
    await expect(getPendingEmailChange("user-1")).resolves.toBeNull()
  })

  it("keeps an address that contains a colon intact", async () => {
    // Not a valid mailbox, but the parser must not cut the address at a later colon.
    const { token } = await generateEmailChangeToken("user-1", "odd:name@example.test")
    await expect(consumeEmailChangeToken(token)).resolves.toEqual({ userId: "user-1", newEmail: "odd:name@example.test" })
  })

  it("cancelling removes the pending request of that user only", async () => {
    await generateEmailChangeToken("user-1", "new@example.test")
    await generateEmailChangeToken("user-2", "other@example.test")

    await cancelEmailChange("user-1")

    await expect(getPendingEmailChange("user-1")).resolves.toBeNull()
    await expect(getPendingEmailChange("user-2")).resolves.toBe("other@example.test")
  })
})

describe("token kinds do not stand in for each other", () => {
  it("an email-change link cannot verify an email or reset a password, and survives the attempt", async () => {
    const { token } = await generateEmailChangeToken("user-1", "new@example.test")

    await expect(consumeVerificationToken(token)).resolves.toBeNull()
    await expect(consumePasswordResetToken(token)).resolves.toBeNull()
    await expect(consumeEmailChangeToken(token)).resolves.toEqual({ userId: "user-1", newEmail: "new@example.test" })
  })

  it("a sign-up verification link or a password-reset link cannot change an email", async () => {
    table.rows.push(
      { identifier: "someone@example.test", token: "verify-token", expires: new Date(Date.now() + HOUR) },
      { identifier: "pwd-reset:someone@example.test", token: "reset-token", expires: new Date(Date.now() + HOUR) },
    )

    await expect(consumeEmailChangeToken("verify-token")).resolves.toBeNull()
    await expect(consumeEmailChangeToken("reset-token")).resolves.toBeNull()
    await expect(peekEmailChangeToken("verify-token")).resolves.toBeNull()
    expect(table.rows).toHaveLength(2)
  })
})
