import { randomBytes, randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { __resetLanguageCache, isPublicLanguage } from "./languages"
import { normalizePath } from "./paths"
import { __resetThrottle, planWrite } from "./throttle"
import { deviceClass, isBot, referrerHost, utcDay, visitorKey } from "./visitor"

/**
 * Anonymous visitor statistics: recording, the live "who is online" counts, the traffic report and
 * the hourly rollup. See prisma/schema.prisma (Stats*) for what is stored and what is not.
 */

/** A visitor counts as online for this long after their last page view or ping. */
export const ONLINE_WINDOW_MS = 60_000
/** Raw page views are kept this long; older days survive only as daily totals. */
export const RAW_RETENTION_DAYS = 90
const PRESENCE_RETENTION_MS = 60 * 60_000
const DAY_MS = 86_400_000
const MAX_REPORT_DAYS = 366
const TOP_LIMIT = 10

/**
 * Timestamp columns hold UTC wall-clock time without a zone. Passing a bound as text cast to
 * `timestamp` keeps raw-SQL comparisons in UTC whatever the database session's TimeZone is.
 */
const utcTimestamp = (at: Date) => Prisma.sql`${at.toISOString()}::timestamp`

export interface Hit {
  type: "pageview" | "ping"
  path: string
  referrer?: string | null
}

export interface Visitor {
  ip: string
  userAgent: string
  signedIn: boolean
  /** The site's own host, so internal navigation is not counted as a referrer. */
  siteHost: string
}

// ---------------------------------------------------------------------------------------------
// Daily salt
// ---------------------------------------------------------------------------------------------

let cachedSalt: { day: number; salt: Promise<string> } | null = null

/** For tests: forget this process's cached salt, write throttle and language lookups. */
export function __resetSaltCache(): void {
  cachedSalt = null
  __resetThrottle()
  __resetLanguageCache()
}

async function loadSalt(day: Date): Promise<string> {
  await prisma.statsSalt.createMany({ data: [{ day, salt: randomBytes(32).toString("hex") }], skipDuplicates: true })
  const [row] = await prisma.$transaction([
    prisma.statsSalt.findUniqueOrThrow({ where: { day } }),
    prisma.statsSalt.deleteMany({ where: { day: { lt: day } } }),
  ])
  return row.salt
}

/**
 * The random salt for the instant's UTC day, shared by every process through the database. The
 * first process to need a new day's salt also deletes the previous days' salts, after which
 * yesterday's visitor keys can no longer be recomputed from an IP and User-Agent. Concurrent hits
 * share one lookup.
 */
function saltFor(now: Date): Promise<string> {
  const day = utcDay(now)
  if (cachedSalt?.day !== day.getTime()) {
    const salt = loadSalt(day)
    cachedSalt = { day: day.getTime(), salt }
    salt.catch(() => {
      if (cachedSalt?.salt === salt) cachedSalt = null // retry on the next hit
    })
  }
  return cachedSalt!.salt
}

// ---------------------------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------------------------

/**
 * Page views are stored with the hour, not the instant: enough for daily and hourly totals, too
 * coarse to line a signed-in visit up with that account's own timestamped edits.
 */
const toHour = (at: Date) => new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000)

/**
 * Counts one page view or keep-alive ping. Returns false when the hit is not counted (a bot, an
 * uncounted page, or a duplicate dropped by the write throttle).
 */
export async function recordHit(hit: Hit, visitor: Visitor, now: Date = new Date()): Promise<boolean> {
  if (isBot(visitor.userAgent)) return false
  const page = normalizePath(hit.path)
  if (!page) return false

  const key = visitorKey(await saltFor(now), visitor.ip, visitor.userAgent)
  // The actual pathname (in memory only), so two different languages' pages are two views.
  const plan = planWrite(hit.type, key, hit.path.split(/[?#]/, 1)[0], now.getTime())
  if (!plan.presence && !plan.pageView) return false

  if (!plan.pageView) {
    await prisma.statsPresence.upsert({
      where: { visitorKey: key },
      create: { visitorKey: key, path: page.path, signedIn: visitor.signedIn, lastSeen: now },
      update: { path: page.path, signedIn: visitor.signedIn, lastSeen: now },
    })
    return true
  }

  const languageSlug = page.languageSlug && (await isPublicLanguage(page.languageSlug)) ? page.languageSlug : null
  // Presence and page view in one statement: one round trip, and both or neither are written.
  await prisma.$executeRaw`
    WITH presence AS (
      INSERT INTO stats_presence ("visitorKey", path, "signedIn", "lastSeen")
      VALUES (${key}, ${page.path}, ${visitor.signedIn}, ${utcTimestamp(now)})
      ON CONFLICT ("visitorKey") DO UPDATE
        SET path = EXCLUDED.path, "signedIn" = EXCLUDED."signedIn", "lastSeen" = EXCLUDED."lastSeen"
    )
    INSERT INTO stats_page_views (id, "createdAt", path, "languageSlug", "visitorKey", "signedIn", referrer, device)
    VALUES (${randomUUID()}, ${utcTimestamp(toHour(now))}, ${page.path}, ${languageSlug}, ${key}, ${visitor.signedIn},
            ${referrerHost(hit.referrer, visitor.siteHost)}, ${deviceClass(visitor.userAgent)})`
  return true
}

// ---------------------------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------------------------

export interface LiveStats {
  online: number
  signedIn: number
  guests: number
  pages: { path: string; visitors: number }[]
  at: string
}

export async function getLiveStats(now: Date = new Date()): Promise<LiveStats> {
  const since = utcTimestamp(new Date(now.getTime() - ONLINE_WINDOW_MS))
  // One transaction, so the total and the per-page counts describe the same moment.
  const [bySignedIn, pages] = await prisma.$transaction([
    prisma.$queryRaw<{ signedIn: boolean; visitors: number }[]>`
      SELECT "signedIn", count(*)::int AS visitors FROM stats_presence WHERE "lastSeen" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ path: string; visitors: number }[]>`
      SELECT path, count(*)::int AS visitors FROM stats_presence WHERE "lastSeen" >= ${since}
      GROUP BY path ORDER BY visitors DESC, path LIMIT ${TOP_LIMIT}`,
  ])
  const count = (signedIn: boolean) => bySignedIn.find((row) => row.signedIn === signedIn)?.visitors ?? 0
  const signedIn = count(true)
  const guests = count(false)
  return { online: signedIn + guests, signedIn, guests, pages, at: now.toISOString() }
}

// ---------------------------------------------------------------------------------------------
// Traffic report
// ---------------------------------------------------------------------------------------------

export interface DailyTraffic {
  date: string
  pageViews: number
  visitors: number
}

export interface TrafficReport {
  days: number
  daily: DailyTraffic[]
  totals: { pageViews: number; visitorDays: number; today: { pageViews: number; visitors: number } }
  topPages: { path: string; views: number; visitors: number }[]
  languages: { slug: string; name: string; views: number }[]
  referrers: { host: string; views: number }[]
  devices: { device: string; views: number }[]
}

const isoDate = (day: Date) => day.toISOString().slice(0, 10)

/** Page views and distinct visitors per UTC day for the last `days` days, today included. */
export async function getTrafficReport(days = 30, now: Date = new Date()): Promise<TrafficReport> {
  const span = Math.min(Math.max(Math.trunc(days) || 1, 1), MAX_REPORT_DAYS)
  const today = utcDay(now)
  const from = new Date(today.getTime() - (span - 1) * DAY_MS)
  const since = utcTimestamp(from)

  const [rawDays, rolledUp, topPages, languages, referrers, devices] = await Promise.all([
    prisma.$queryRaw<{ day: Date; views: number; visitors: number }[]>`
      SELECT "createdAt"::date AS day, count(*)::int AS views, count(DISTINCT "visitorKey")::int AS visitors
      FROM stats_page_views WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.statsDaily.findMany({ where: { day: { gte: from } } }),
    prisma.$queryRaw<{ path: string; views: number; visitors: number }[]>`
      SELECT path, count(*)::int AS views, count(DISTINCT "visitorKey")::int AS visitors
      FROM stats_page_views WHERE "createdAt" >= ${since}
      GROUP BY path ORDER BY views DESC, path LIMIT ${TOP_LIMIT}`,
    // Only public languages are listed: the owner's own visits to a private project are counted
    // in the totals but never named, and URLs for languages that do not exist are not listed.
    prisma.$queryRaw<{ slug: string; name: string; views: number }[]>`
      SELECT v."languageSlug" AS slug, l.name, count(*)::int AS views
      FROM stats_page_views v JOIN languages l ON l.slug = v."languageSlug" AND l.visibility = 'PUBLIC'
      WHERE v."createdAt" >= ${since}
      GROUP BY v."languageSlug", l.name ORDER BY views DESC, slug LIMIT ${TOP_LIMIT}`,
    prisma.$queryRaw<{ host: string; views: number }[]>`
      SELECT referrer AS host, count(*)::int AS views
      FROM stats_page_views WHERE "createdAt" >= ${since} AND referrer IS NOT NULL
      GROUP BY referrer ORDER BY views DESC, host LIMIT ${TOP_LIMIT}`,
    prisma.$queryRaw<{ device: string; views: number }[]>`
      SELECT device, count(*)::int AS views
      FROM stats_page_views WHERE "createdAt" >= ${since}
      GROUP BY device ORDER BY views DESC, device`,
  ])

  // Raw rows are exact; days whose raw rows were pruned fall back to their daily totals.
  const byDate = new Map<string, DailyTraffic>()
  for (const row of rolledUp) {
    byDate.set(isoDate(row.day), { date: isoDate(row.day), pageViews: row.pageViews, visitors: row.visitors })
  }
  for (const row of rawDays) {
    byDate.set(isoDate(row.day), { date: isoDate(row.day), pageViews: row.views, visitors: row.visitors })
  }
  const daily = Array.from({ length: span }, (_, i) => {
    const date = isoDate(new Date(from.getTime() + i * DAY_MS))
    return byDate.get(date) ?? { date, pageViews: 0, visitors: 0 }
  })
  const last = daily[daily.length - 1]

  return {
    days: span,
    daily,
    totals: {
      pageViews: daily.reduce((sum, d) => sum + d.pageViews, 0),
      visitorDays: daily.reduce((sum, d) => sum + d.visitors, 0),
      today: { pageViews: last.pageViews, visitors: last.visitors },
    },
    topPages,
    languages,
    referrers,
    devices,
  }
}

// ---------------------------------------------------------------------------------------------
// Rollup and retention
// ---------------------------------------------------------------------------------------------

/**
 * Hourly: writes the daily totals of every finished day not yet rolled up (and re-checks the
 * latest one), then deletes raw page views older than the retention, presence rows nobody has
 * refreshed for an hour and salts of past days. Idempotent.
 */
export async function rollupAndPrune(now: Date = new Date()): Promise<{ rolledUp: number; pruned: number }> {
  const today = utcDay(now)
  const before = utcTimestamp(today)
  const stamp = utcTimestamp(now)
  const rawCutoff = new Date(today.getTime() - RAW_RETENTION_DAYS * DAY_MS)

  const [rolledUp, pruned] = await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO stats_daily (day, "pageViews", visitors, "signedInVisitors", "updatedAt")
      SELECT "createdAt"::date, count(*)::int, count(DISTINCT "visitorKey")::int,
             (count(DISTINCT "visitorKey") FILTER (WHERE "signedIn"))::int, ${stamp}
      FROM stats_page_views
      WHERE "createdAt" < ${before}
        AND ("createdAt" >= COALESCE((SELECT max(day) FROM stats_daily)::timestamp, '-infinity'::timestamp)
             OR NOT EXISTS (SELECT 1 FROM stats_daily d WHERE d.day = stats_page_views."createdAt"::date))
      GROUP BY 1
      ON CONFLICT (day) DO UPDATE SET
        "pageViews" = EXCLUDED."pageViews",
        visitors = EXCLUDED.visitors,
        "signedInVisitors" = EXCLUDED."signedInVisitors",
        "updatedAt" = EXCLUDED."updatedAt"`,
    prisma.statsPageView.deleteMany({ where: { createdAt: { lt: rawCutoff } } }),
    prisma.statsPresence.deleteMany({ where: { lastSeen: { lt: new Date(now.getTime() - PRESENCE_RETENTION_MS) } } }),
    prisma.statsSalt.deleteMany({ where: { day: { lt: today } } }),
  ])
  return { rolledUp, pruned: pruned.count }
}
