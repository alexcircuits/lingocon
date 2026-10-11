// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const recordHit = vi.hoisted(() => vi.fn())
const isAdmin = vi.hoisted(() => vi.fn())
const getLiveStats = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin", () => ({ isAdmin }))
vi.mock("@/lib/stats/store", () => ({ recordHit, getLiveStats }))

import { POST } from "@/app/api/stats/route"
import { GET as getLive } from "@/app/api/admin/stats/live/route"

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
let ipCounter = 0

function beacon(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body)
  return new NextRequest("https://lingocon.com/api/stats", {
    method: "POST",
    body: text,
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      host: "lingocon.com",
      origin: "https://lingocon.com",
      "sec-fetch-site": "same-origin",
      "user-agent": CHROME,
      "x-real-ip": `198.51.100.${++ipCounter % 250}`,
      ...headers,
    },
  })
}

describe("POST /api/stats", () => {
  beforeEach(() => {
    recordHit.mockReset()
    recordHit.mockResolvedValue(true)
  })

  it("records a page view without storing anything but what the store is given", async () => {
    const res = await POST(beacon({ type: "pageview", path: "/browse", referrer: "https://duckduckgo.com/" }, { "x-real-ip": "203.0.113.9" }))
    expect(res.status).toBe(204)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(recordHit).toHaveBeenCalledWith(
      { type: "pageview", path: "/browse", referrer: "https://duckduckgo.com/" },
      { ip: "203.0.113.9", userAgent: CHROME, signedIn: false, siteHost: "lingocon.com" }
    )
  })

  it("marks a visitor with a session cookie as signed in, without reading the session", async () => {
    await POST(beacon({ type: "ping", path: "/dashboard" }, { cookie: "__Secure-authjs.session-token=abc" }))
    expect(recordHit.mock.calls[0][1]).toMatchObject({ signedIn: true })
    await POST(beacon({ type: "ping", path: "/dashboard" }, { cookie: "authjs.session-token.0=abc; theme=dark" }))
    expect(recordHit.mock.calls[1][1]).toMatchObject({ signedIn: true })
    await POST(beacon({ type: "ping", path: "/dashboard" }, { cookie: "theme=dark" }))
    expect(recordHit.mock.calls[2][1]).toMatchObject({ signedIn: false })
  })

  it("rejects requests from other sites", async () => {
    expect((await POST(beacon({ type: "pageview", path: "/" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
    expect((await POST(beacon({ type: "pageview", path: "/" }, { "sec-fetch-site": "", origin: "https://evil.example" }))).status).toBe(403)
    expect(recordHit).not.toHaveBeenCalled()
  })

  it("rejects malformed and oversized bodies", async () => {
    for (const body of ["not json", { type: "click", path: "/" }, { type: "pageview" }, { type: "pageview", path: "/" + "a".repeat(600) }]) {
      expect((await POST(beacon(body))).status, JSON.stringify(body)).toBe(400)
    }
    expect((await POST(beacon({ type: "pageview", path: "/", referrer: "x".repeat(3000) }))).status).toBe(413)
    expect(recordHit).not.toHaveBeenCalled()
  })

  it("honours Do Not Track and Global Privacy Control", async () => {
    expect((await POST(beacon({ type: "pageview", path: "/" }, { dnt: "1" }))).status).toBe(204)
    expect((await POST(beacon({ type: "pageview", path: "/" }, { "sec-gpc": "1" }))).status).toBe(204)
    expect(recordHit).not.toHaveBeenCalled()
  })

  it("rate-limits one address, and one IPv6 /64 as one address", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 310; i++) {
      statuses.push((await POST(beacon({ type: "ping", path: "/" }, { "x-real-ip": `2001:db8:77:1::${i.toString(16)}` }))).status)
    }
    expect(statuses.filter((s) => s === 204)).toHaveLength(300)
    expect(statuses.at(-1)).toBe(429)
  })

  it("answers bots without touching the database", async () => {
    expect((await POST(beacon({ type: "pageview", path: "/" }, { "user-agent": "Googlebot/2.1" }))).status).toBe(204)
    expect(recordHit).not.toHaveBeenCalled()
  })

  it("answers even when the database is down, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    recordHit.mockRejectedValue(new Error("db down"))
    const res = await POST(beacon({ type: "pageview", path: "/" }))
    expect(res.status).toBe(500)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe("GET /api/admin/stats/live", () => {
  beforeEach(() => {
    isAdmin.mockReset()
    getLiveStats.mockReset()
  })

  it("is refused to anyone but an admin", async () => {
    isAdmin.mockResolvedValue(false)
    const res = await getLive()
    expect(res.status).toBe(403)
    expect(getLiveStats).not.toHaveBeenCalled()
  })

  it("returns the live counts to an admin, uncached", async () => {
    isAdmin.mockResolvedValue(true)
    getLiveStats.mockResolvedValue({ online: 2, signedIn: 1, guests: 1, pages: [], at: "2026-10-11T10:00:00.000Z" })
    const res = await getLive()
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await res.json()).toMatchObject({ online: 2, signedIn: 1, guests: 1 })
  })
})
