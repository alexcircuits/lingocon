// @vitest-environment node
/**
 * REAL-DATABASE test for the anonymous statistics store.
 *
 * Skipped unless DATABASE_URL points at a disposable local `lingocon_rewrite_test_*` database
 * (migrations applied). It empties the stats_* tables, which nothing else in that database uses.
 *
 *   DATABASE_URL=postgresql://…@localhost:5432/lingocon_rewrite_test_… npx vitest run store.integration
 */
import { randomUUID } from "node:crypto"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

const testDb = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_\w+$/.test(url.pathname)
      && url.search === ""
  } catch {
    return false
  }
})()

import { prisma } from "@/lib/prisma"
import { __resetSaltCache, getLiveStats, getTrafficReport, recordHit, rollupAndPrune } from "../store"

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const IP = "203.0.113.77"
const who = (over: Partial<{ ip: string; userAgent: string; signedIn: boolean }> = {}) => ({
  ip: IP,
  userAgent: CHROME,
  signedIn: false,
  siteHost: "lingocon.com",
  ...over,
})
const at = (iso: string) => new Date(iso)

async function wipe() {
  await prisma.$transaction([
    prisma.statsPageView.deleteMany(),
    prisma.statsPresence.deleteMany(),
    prisma.statsDaily.deleteMany(),
    prisma.statsSalt.deleteMany(),
  ])
  __resetSaltCache()
}

describe.skipIf(!testDb)("anonymous statistics store (real Postgres)", () => {
  beforeEach(wipe)
  afterAll(async () => {
    await wipe()
    await prisma.$disconnect()
  })

  it("records a page view as a route template with nothing that identifies the visitor", async () => {
    const now = at("2026-10-11T10:17:42.123Z")
    await recordHit({ type: "pageview", path: "/studio/lang/secret-project/dictionary?q=x", referrer: "https://www.reddit.com/r/conlangs" }, who(), now)

    const [view] = await prisma.statsPageView.findMany()
    expect(view).toMatchObject({ path: "/studio/lang/[slug]/dictionary", languageSlug: null, referrer: "reddit.com", device: "desktop", signedIn: false })
    expect(view.visitorKey).toMatch(/^[0-9a-f]{32}$/)
    // Only the hour, so a signed-in view cannot be lined up with that account's own edits.
    expect(view.createdAt.toISOString()).toBe("2026-10-11T10:00:00.000Z")
    // Presence keeps the instant (for "online now") and is deleted after an hour.
    expect((await prisma.statsPresence.findFirstOrThrow()).lastSeen.toISOString()).toBe("2026-10-11T10:17:42.123Z")
    const stored = JSON.stringify([await prisma.statsPageView.findMany(), await prisma.statsPresence.findMany()])
    expect(stored).not.toContain(IP)
    expect(stored).not.toContain("Chrome")
    expect(stored).not.toContain("secret-project")
  })

  it("drops a reload of the same page within seconds, so a script cannot multiply rows", async () => {
    const now = at("2026-10-11T10:00:00Z")
    expect(await recordHit({ type: "pageview", path: "/browse" }, who(), now)).toBe(true)
    expect(await recordHit({ type: "pageview", path: "/browse" }, who(), new Date(now.getTime() + 1_000))).toBe(false)
    expect(await prisma.statsPageView.count()).toBe(1)
  })

  it("ignores bots and pages that are not counted", async () => {
    const now = at("2026-10-11T10:00:00Z")
    expect(await recordHit({ type: "pageview", path: "/browse" }, who({ userAgent: "Googlebot/2.1" }), now)).toBe(false)
    expect(await recordHit({ type: "pageview", path: "/admin/users" }, who(), now)).toBe(false)
    expect(await prisma.statsPageView.count()).toBe(0)
    expect(await prisma.statsPresence.count()).toBe(0)
  })

  it("rotates the salt daily and deletes the previous one, so days cannot be linked", async () => {
    await recordHit({ type: "pageview", path: "/browse" }, who(), at("2026-10-11T23:59:00Z"))
    const [first] = await prisma.statsSalt.findMany()
    __resetSaltCache()
    await recordHit({ type: "pageview", path: "/browse" }, who(), at("2026-10-12T00:01:00Z"))

    const keys = (await prisma.statsPageView.findMany({ orderBy: { createdAt: "asc" } })).map((v) => v.visitorKey)
    expect(keys[0]).not.toBe(keys[1])
    const salts = await prisma.statsSalt.findMany()
    expect(salts).toHaveLength(1)
    expect(salts[0].salt).not.toBe(first.salt)
    expect(salts[0].day.toISOString()).toBe("2026-10-12T00:00:00.000Z")
  })

  it("counts who is online in the last minute, signed in or not, and on which pages", async () => {
    const now = at("2026-10-11T10:00:00Z")
    await recordHit({ type: "pageview", path: "/browse" }, who({ ip: "198.51.100.1" }), at("2026-10-11T09:59:30Z"))
    await recordHit({ type: "ping", path: "/browse" }, who({ ip: "198.51.100.2", signedIn: true }), at("2026-10-11T09:59:50Z"))
    await recordHit({ type: "ping", path: "/lang/elvish" }, who({ ip: "198.51.100.3", userAgent: PHONE }), at("2026-10-11T09:59:40Z"))
    // Gone: last seen two minutes ago.
    await recordHit({ type: "ping", path: "/browse" }, who({ ip: "198.51.100.4" }), at("2026-10-11T09:58:00Z"))
    // The same visitor moving on is counted once, on the new page.
    await recordHit({ type: "pageview", path: "/search" }, who({ ip: "198.51.100.1" }), at("2026-10-11T09:59:55Z"))

    const live = await getLiveStats(now)
    expect(live).toMatchObject({ online: 3, signedIn: 1, guests: 2 })
    expect(live.pages).toEqual(
      expect.arrayContaining([{ path: "/browse", visitors: 1 }, { path: "/lang/[slug]", visitors: 1 }, { path: "/search", visitors: 1 }])
    )
  })

  it("reports daily page views, distinct visitors, top pages, languages, referrers and devices", async () => {
    const prefix = `stats-${randomUUID().slice(0, 8)}`
    await prisma.user.create({ data: { id: `${prefix}-owner`, email: `${prefix}@example.test` } })
    const language = (slug: string, name: string, visibility: "PUBLIC" | "PRIVATE") =>
      prisma.language.create({ data: { slug: `${prefix}-${slug}`, name, visibility, ownerId: `${prefix}-owner` } })
    await language("elvish", "Elvish", "PUBLIC")
    await language("dwarvish", "Dwarvish", "PUBLIC")
    await language("secret", "Secret", "PRIVATE")
    try {
      const day1 = "2026-10-10T12:00:00Z"
      const day2 = "2026-10-11T12:00:00Z"
      await recordHit({ type: "pageview", path: `/lang/${prefix}-elvish`, referrer: "https://duckduckgo.com/" }, who({ ip: "198.51.100.1" }), at(day1))
      await recordHit({ type: "pageview", path: `/lang/${prefix}-elvish/dictionary` }, who({ ip: "198.51.100.1" }), at(day1))
      await recordHit({ type: "pageview", path: `/lang/${prefix}-dwarvish` }, who({ ip: "198.51.100.2", userAgent: PHONE }), at(day2))
      await recordHit({ type: "pageview", path: "/browse" }, who({ ip: "198.51.100.3", signedIn: true }), at(day2))
      await recordHit({ type: "ping", path: "/browse" }, who({ ip: "198.51.100.3" }), at(day2))
      // The owner reading their own private project, and a URL for a language that does not exist.
      await recordHit({ type: "pageview", path: `/lang/${prefix}-secret` }, who({ ip: "198.51.100.4" }), at(day2))
      await recordHit({ type: "pageview", path: "/lang/no-such-language" }, who({ ip: "198.51.100.4" }), at(day2))

      const report = await getTrafficReport(7, at("2026-10-11T20:00:00Z"))
      expect(report.daily).toHaveLength(7)
      expect(report.daily.slice(-2)).toEqual([
        { date: "2026-10-10", pageViews: 2, visitors: 1 },
        { date: "2026-10-11", pageViews: 4, visitors: 3 },
      ])
      expect(report.totals).toMatchObject({ pageViews: 6, visitorDays: 4, today: { pageViews: 4, visitors: 3 } })
      expect(report.topPages[0]).toMatchObject({ path: "/lang/[slug]", views: 4 })
      // Only public languages are listed, by name.
      expect(report.languages).toEqual([
        { slug: `${prefix}-elvish`, name: "Elvish", views: 2 },
        { slug: `${prefix}-dwarvish`, name: "Dwarvish", views: 1 },
      ])
      expect(report.referrers).toEqual([{ host: "duckduckgo.com", views: 1 }])
      expect(report.devices).toEqual([{ device: "desktop", views: 5 }, { device: "mobile", views: 1 }])
      // The private project's slug and the made-up one never reach the database at all.
      const slugs = (await prisma.statsPageView.findMany({ select: { languageSlug: true } })).map((v) => v.languageSlug)
      expect(slugs.filter(Boolean).sort()).toEqual([`${prefix}-dwarvish`, `${prefix}-elvish`, `${prefix}-elvish`])
    } finally {
      await prisma.user.delete({ where: { id: `${prefix}-owner` } })
    }
  })

  it("rolls finished days up, then prunes old page views, stale presence and old salts", async () => {
    await recordHit({ type: "pageview", path: "/browse" }, who({ ip: "198.51.100.1" }), at("2026-06-01T12:00:00Z"))
    await recordHit({ type: "pageview", path: "/browse" }, who({ ip: "198.51.100.2", signedIn: true }), at("2026-10-10T12:00:00Z"))
    await recordHit({ type: "pageview", path: "/browse" }, who({ ip: "198.51.100.3" }), at("2026-10-10T13:00:00Z"))
    await recordHit({ type: "pageview", path: "/browse" }, who({ ip: "198.51.100.4" }), at("2026-10-11T09:30:00Z"))
    // A salt left behind by a process that stopped before midnight.
    await prisma.statsSalt.create({ data: { day: at("2026-10-09T00:00:00Z"), salt: "stale" } })

    await rollupAndPrune(at("2026-10-11T10:00:00Z"))

    const daily = await prisma.statsDaily.findMany({ orderBy: { day: "asc" } })
    expect(daily.map((d) => [d.day.toISOString().slice(0, 10), d.pageViews, d.visitors, d.signedInVisitors])).toEqual([
      ["2026-06-01", 1, 1, 0],
      ["2026-10-10", 2, 2, 1],
    ])
    // Older than 90 days: rolled up, then deleted. Today's views stay raw until the day is over.
    const left = await prisma.statsPageView.findMany({ orderBy: { createdAt: "asc" } })
    expect(left.map((v) => v.createdAt.toISOString().slice(0, 10))).toEqual(["2026-10-10", "2026-10-10", "2026-10-11"])
    expect(await prisma.statsPresence.count()).toBe(1)
    expect((await prisma.statsSalt.findMany()).map((s) => s.day.toISOString().slice(0, 10))).toEqual(["2026-10-11"])

    // Idempotent.
    await rollupAndPrune(at("2026-10-11T10:00:00Z"))
    expect(await prisma.statsDaily.count()).toBe(2)

    // A finished day that was never rolled up (e.g. restored rows) is still totalled before it ages out.
    await prisma.statsPageView.create({ data: { createdAt: at("2026-10-05T08:00:00Z"), path: "/browse", visitorKey: "k".repeat(32), device: "desktop" } })
    await rollupAndPrune(at("2026-10-11T10:00:00Z"))
    expect((await prisma.statsDaily.findUnique({ where: { day: at("2026-10-05T00:00:00Z") } }))?.pageViews).toBe(1)
  })

  it("uses the daily totals for days older than the raw retention", async () => {
    await prisma.statsDaily.create({ data: { day: at("2026-05-01T00:00:00Z"), pageViews: 40, visitors: 12, signedInVisitors: 3 } })
    const report = await getTrafficReport(365, at("2026-10-11T12:00:00Z"))
    expect(report.daily.find((d) => d.date === "2026-05-01")).toEqual({ date: "2026-05-01", pageViews: 40, visitors: 12 })
    expect(report.totals.pageViews).toBe(40)
  })
})
