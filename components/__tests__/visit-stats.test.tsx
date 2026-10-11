import { act, render } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VisitStats } from "../visit-stats"

const sendBeacon = vi.fn((_url: string, _body: string) => true)
const sent = () => sendBeacon.mock.calls.map(([url, body]) => ({ url, ...JSON.parse(body) }))

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("VisitStats", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sendBeacon.mockClear()
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon })
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: null })
    Object.defineProperty(document, "referrer", { configurable: true, value: "https://duckduckgo.com/" })
    setVisibility("visible")
    sendBeacon.mockClear()
    vi.mocked(usePathname).mockReturnValue("/browse")
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.mocked(usePathname).mockReturnValue("/")
    Reflect.deleteProperty(navigator, "globalPrivacyControl")
  })

  it("sends one page view per navigation, with the referrer only on the first", () => {
    const view = render(<VisitStats />)
    vi.mocked(usePathname).mockReturnValue("/lang/elvish")
    view.rerender(<VisitStats />)
    view.rerender(<VisitStats />)
    expect(sent()).toEqual([
      { url: "/api/stats", type: "pageview", path: "/browse", referrer: "https://duckduckgo.com/" },
      { url: "/api/stats", type: "pageview", path: "/lang/elvish", referrer: null },
    ])
  })

  it("pings every 25 seconds while the tab is visible, and again when it comes back", () => {
    render(<VisitStats />)
    sendBeacon.mockClear()
    act(() => void vi.advanceTimersByTime(25_000))
    expect(sent()).toEqual([{ url: "/api/stats", type: "ping", path: "/browse" }])

    setVisibility("hidden")
    act(() => void vi.advanceTimersByTime(75_000))
    expect(sent()).toHaveLength(1)

    setVisibility("visible")
    expect(sent()).toHaveLength(2)
    expect(sent()[1]).toMatchObject({ type: "ping", path: "/browse" })
  })

  it("sends nothing when the browser asks not to be tracked", () => {
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true })
    render(<VisitStats />)
    act(() => void vi.advanceTimersByTime(60_000))
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it("does not count the admin panel, nor credit its referrer to the next page", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/traffic")
    const view = render(<VisitStats />)
    act(() => void vi.advanceTimersByTime(60_000))
    expect(sendBeacon).not.toHaveBeenCalled()

    vi.mocked(usePathname).mockReturnValue("/browse")
    view.rerender(<VisitStats />)
    expect(sent()).toEqual([{ url: "/api/stats", type: "pageview", path: "/browse", referrer: null }])
  })

  it("falls back to fetch when sendBeacon refuses", () => {
    sendBeacon.mockReturnValueOnce(false)
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal("fetch", fetchMock)
    try {
      render(<VisitStats />)
      expect(fetchMock).toHaveBeenCalledWith("/api/stats", expect.objectContaining({ method: "POST", keepalive: true }))
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
