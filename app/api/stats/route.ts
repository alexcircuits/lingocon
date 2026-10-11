import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders, ipRateLimitKey } from "@/lib/request-ip"
import { recordHit } from "@/lib/stats/store"
import { isBot } from "@/lib/stats/visitor"

export const dynamic = "force-dynamic"

/**
 * Anonymous page-view and presence beacon (components/visit-stats.tsx). Sets no cookie and stores
 * no IP: see lib/stats. The client sends `text/plain` JSON through navigator.sendBeacon.
 */

const MAX_BODY_BYTES = 2048
// Per address (an IPv6 /64) and process. Generous: a school or office shares one address, and
// every open tab pings about twice a minute.
const RATE_LIMIT = 300
// Everyone together, per process: bounds the database writes this public endpoint can cause
// whatever the number of addresses (lib/stats/throttle.ts also caps stored page views per day).
const GLOBAL_RATE_LIMIT = 3_000
const RATE_WINDOW_MS = 60_000
// Auth.js session cookies (plain, __Secure- on https, and `.0`, `.1`… when split into chunks).
// Their presence is enough for "signed in vs guest"; the session itself is never decoded here.
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/

const hitSchema = z.object({
  type: z.enum(["pageview", "ping"]),
  path: z.string().min(1).max(512),
  referrer: z.string().max(1024).nullish(),
})

const noContent = (status = 204) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } })

function isCrossSite(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite) return fetchSite !== "same-origin"
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    return new URL(origin).host !== request.headers.get("host")
  } catch {
    return true
  }
}

function optedOut(request: NextRequest): boolean {
  return request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1"
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isCrossSite(request)) return noContent(403)
  const userAgent = request.headers.get("user-agent") ?? ""
  if (optedOut(request) || isBot(userAgent)) return noContent()

  const ip = clientIpFromHeaders(request.headers)
  if (!rateLimit(`stats:${ipRateLimitKey(ip)}`, RATE_LIMIT, RATE_WINDOW_MS).ok) return noContent(429)
  if (!rateLimit("stats:global", GLOBAL_RATE_LIMIT, RATE_WINDOW_MS).ok) return noContent(429)

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return noContent(413)
  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) return noContent(413)

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return noContent(400)
  }
  const hit = hitSchema.safeParse(json)
  if (!hit.success) return noContent(400)

  try {
    await recordHit(hit.data, {
      ip,
      userAgent,
      signedIn: request.cookies.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name)),
      siteHost: request.headers.get("host") ?? "",
    })
    return noContent()
  } catch (error) {
    console.error("[stats] could not record a hit:", error)
    return noContent(500)
  }
}
