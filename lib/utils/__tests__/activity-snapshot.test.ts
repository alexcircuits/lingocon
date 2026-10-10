// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => {
  const tx = {
    activity: { findMany: vi.fn(async () => [{ id: "a1" }]) },
  }
  return {
    tx,
    prisma: {
      activity: { findMany: vi.fn(async () => [{ id: "outside" }]) },
      language: { findMany: vi.fn(async () => [{ id: "lang-1" }]) },
      follow: { findMany: vi.fn(async () => [{ followingId: "u2" }]) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown, _options?: unknown) => fn(tx)),
    },
  }
})
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }))
vi.mock("@prisma/client", () => ({ Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } } }))

import {
  getActivitiesForLanguage,
  getActivitiesForUser,
  getFeedActivitiesForUser,
  getRecentActivitiesForUserLanguages,
} from "../activity"

beforeEach(() => vi.clearAllMocks())

// Prisma loads `include`d relations with a second query. A language (or user) deleted between
// the two made the required relation come back null: "Inconsistent query result", and the
// dashboard crashed. One REPEATABLE READ snapshot keeps the rows and their relations consistent.
describe.each([
  ["getActivitiesForLanguage", () => getActivitiesForLanguage("lang-1")],
  ["getActivitiesForUser", () => getActivitiesForUser("u1", "u1")],
  ["getRecentActivitiesForUserLanguages", () => getRecentActivitiesForUserLanguages("u1")],
  ["getFeedActivitiesForUser", () => getFeedActivitiesForUser("u1")],
])("%s", (_name, read) => {
  it("reads activities and their relations from one snapshot", async () => {
    await expect(read()).resolves.toEqual([{ id: "a1" }])
    expect(db.prisma.activity.findMany).not.toHaveBeenCalled()
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(db.prisma.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "RepeatableRead" })
    expect(db.tx.activity.findMany).toHaveBeenCalledTimes(1)
  })
})
