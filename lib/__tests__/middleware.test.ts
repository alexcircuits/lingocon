import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(new URL(path, "http://localhost:3000"), { method: init.method ?? "GET", headers: init.headers })
}

describe("slug-reservation middleware", () => {
  const fetchMock = vi.fn()
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // What middleware really receives: Next (14.2, 15.5) strips the RSC, router-state and
  // prefetch headers and the `_rsc` query parameter before middleware runs
  // (next/dist/server/web/adapter.js), so in-app fetches look like plain fetches.
  const browserDocument = { "sec-fetch-dest": "document", accept: "text/html,application/xhtml+xml,*/*;q=0.8" }
  it.each([
    ["RSC navigation / prefetch", { headers: { "sec-fetch-dest": "empty", accept: "*/*", "next-url": "/studio/lang/old-slug" } }],
    ["client fetch()", { headers: { "sec-fetch-dest": "empty", accept: "application/json" } }],
    ["no browser hints and no HTML accept", { headers: { accept: "*/*" } }],
    ["server action POST", { method: "POST", headers: { "next-action": "abc", ...browserDocument } }],
    ["plain POST", { method: "POST" }],
  ])("skips the loopback lookup for anything but a page load: %s", async (_label, init) => {
    vi.stubGlobal("fetch", fetchMock)
    const response = await middleware(request("/studio/lang/old-slug/dictionary", init))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.headers.get("location")).toBeNull()
  })

  // Distinct slugs: the middleware caches each lookup for a minute.
  it.each([
    ["browser page load", "renamed-a", browserDocument],
    ["crawler without fetch metadata", "renamed-b", { accept: "text/html,application/xhtml+xml" }],
    // A navigation the service worker re-issues with fetch() is not marked as a document.
    ["navigation forwarded by the service worker", "renamed-c", { "sec-fetch-dest": "empty", "sec-fetch-mode": "same-origin", accept: "text/html,application/xhtml+xml" }],
  ])("redirects a full page load of a renamed slug, keeping the sub-path: %s", async (_label, oldSlug, headers) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ found: true, newSlug: "new-slug" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const response = await middleware(request(`/studio/lang/${oldSlug}/dictionary`, { headers }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost:3000/studio/lang/new-slug/dictionary")
  })

  it("does not cache 'no reservation': a rename right after a page load still redirects", async () => {
    vi.stubGlobal("fetch", fetchMock)
    // The project is still at this slug: the lookup finds no reservation.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ found: false }), { status: 200 }))
    const before = await middleware(request("/studio/lang/about-to-move/settings", { headers: browserDocument }))
    expect(before.headers.get("location")).toBeNull()
    // Renamed seconds later: the next page load of the old URL must see the reservation.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ found: true, newSlug: "moved" }), { status: 200 }))
    const after = await middleware(request("/studio/lang/about-to-move/dictionary", { headers: browserDocument }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(after.headers.get("location")).toBe("http://localhost:3000/studio/lang/moved/dictionary")
  })

  it.each([
    ["an in-app RSC request", { "sec-fetch-dest": "empty", accept: "*/*" }],
    ["a page load", browserDocument],
  ])("forwards the requested path to server layouts on %s, overwriting a client-supplied one", async (_label, headers) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ found: false }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const response = await middleware(
      request("/studio/lang/some-project/grammar/nouns", { headers: { ...headers, "x-lingocon-pathname": "/forged" } })
    )
    expect(response.headers.get("x-middleware-request-x-lingocon-pathname")).toBe("/studio/lang/some-project/grammar/nouns")
  })

  it("continues normally when the lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error("connection refused"))
    vi.stubGlobal("fetch", fetchMock)
    const response = await middleware(request("/lang/some-slug", { headers: { "sec-fetch-dest": "document", accept: "text/html" } }))
    expect(response.headers.get("location")).toBeNull()
  })

  // Next's edge sandbox keeps every setTimeout id in a per-worker list until clearTimeout runs
  // (next/dist/server/web/sandbox/resource-managers.js). A lookup that timed out or failed never
  // cleared its 2 s timer, so each one left an id behind for the life of the worker.
  // Distinct slugs: a later change to what is cached must not make a case skip the lookup.
  it.each([
    ["the lookup times out", "timer-timeout", () => fetchMock.mockRejectedValue(new DOMException("This operation was aborted", "AbortError"))],
    ["the lookup cannot connect", "timer-offline", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["the lookup answers with an error status", "timer-error-status", () => fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }))],
    ["the lookup finds nothing", "timer-not-found", () => fetchMock.mockResolvedValue(new Response(JSON.stringify({ found: false }), { status: 200 }))],
  ])("clears its timeout when %s", async (_label, slug, arrange) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout")
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    arrange()
    vi.stubGlobal("fetch", fetchMock)
    await middleware(request(`/lang/${slug}`, { headers: browserDocument }))
    const lookupTimers = setTimeoutSpy.mock.calls
      .map((args, i) => ({ ms: args[1], id: setTimeoutSpy.mock.results[i]?.value }))
      .filter((timer) => timer.ms === 2000)
    expect(lookupTimers).toHaveLength(1)
    expect(clearTimeoutSpy).toHaveBeenCalledWith(lookupTimers[0].id)
  })

  it("releases an error response's body instead of leaving the loopback connection open", async () => {
    const failed = new Response("unavailable", { status: 503 })
    fetchMock.mockResolvedValue(failed)
    vi.stubGlobal("fetch", fetchMock)
    const response = await middleware(request("/lang/error-body", { headers: browserDocument }))
    expect(response.headers.get("location")).toBeNull()
    expect(failed.bodyUsed).toBe(true)
  })
})
