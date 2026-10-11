// @vitest-environment node
/**
 * REAL-DATABASE test: the admin growth charts count by UTC day in SQL, whatever the server's time
 * zone (the old code loaded every row and bucketed by the host's local date).
 *
 * Skipped unless DATABASE_URL points at a disposable local `lingocon_rewrite_test_*` database
 * (migrations applied). Creates and deletes only its own uniquely-prefixed rows, and compares
 * counts before and after so other rows in the database do not matter.
 */
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const originalTz = vi.hoisted(() => process.env.TZ)
const testDb = vi.hoisted(() => {
  // A zone far from UTC: local-date bucketing would move the late-evening rows to another day.
  // Restored in afterAll: the worker process may run other test files next.
  process.env.TZ = "America/Los_Angeles"
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_\w+$/.test(url.pathname)
      && url.search === ""
  } catch {
    return false
  }
})
vi.mock("@/lib/admin", () => ({ requireAdmin: vi.fn(async () => undefined) }))

import { prisma } from "@/lib/prisma"
import { getContentGrowth, getUserGrowth } from "../admin-analytics"
import { lastUtcDays } from "@/lib/utils/utc-days"

const prefix = `growth-${randomUUID().slice(0, 8)}`
// Days in the past: other test files create rows "now", concurrently, which would move today's totals.
const window = lastUtcDays(7)
const [lateDay, earlyDay, today] = [window[2], window[3], window[6]]
const at = (day: string, time: string) => new Date(`${day}T${time}Z`)

async function snapshot() {
  const [users, content] = await Promise.all([getUserGrowth(7), getContentGrowth(7)])
  const pick = (date: string) => ({
    signups: users.find((d) => d.fullDate === date)!.signups,
    languages: content.find((d) => d.fullDate === date)!.languages,
    entries: content.find((d) => d.fullDate === date)!.entries,
  })
  return { users, content, late: pick(lateDay), early: pick(earlyDay) }
}

describe.skipIf(!testDb)("admin growth charts (real Postgres)", () => {
  let before: Awaited<ReturnType<typeof snapshot>>

  beforeAll(async () => {
    before = await snapshot()
    // Late in a UTC day, which is still the afternoon in Los Angeles, and just after the next midnight UTC.
    await prisma.user.create({ data: { id: `${prefix}-a`, email: `${prefix}-a@example.test`, createdAt: at(lateDay, "23:30:00") } })
    await prisma.user.create({ data: { id: `${prefix}-b`, email: `${prefix}-b@example.test`, createdAt: at(earlyDay, "00:10:00") } })
    await prisma.language.create({
      data: { id: `${prefix}-lang`, slug: `${prefix}-lang`, name: "Growth", ownerId: `${prefix}-a`, createdAt: at(lateDay, "23:45:00") },
    })
    await prisma.dictionaryEntry.createMany({
      data: [
        { lemma: "a", gloss: "a", languageId: `${prefix}-lang`, createdAt: at(earlyDay, "00:01:00") },
        { lemma: "b", gloss: "b", languageId: `${prefix}-lang`, createdAt: at(earlyDay, "00:02:00") },
      ],
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } })
    await prisma.$disconnect()
  })

  it("buckets rows by their UTC day and labels each day as itself", async () => {
    const after = await snapshot()
    expect(after.late.signups - before.late.signups).toBe(1)
    expect(after.early.signups - before.early.signups).toBe(1)
    expect(after.late.languages - before.late.languages).toBe(1)
    expect(after.early.entries - before.early.entries).toBe(2)

    expect(after.users).toHaveLength(7)
    expect(after.users.at(-1)).toMatchObject({ fullDate: today })
    const label = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    expect(after.users.at(-1)!.date).toBe(label)
    expect(after.content.at(-1)!.date).toBe(label)
  })
})

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})
