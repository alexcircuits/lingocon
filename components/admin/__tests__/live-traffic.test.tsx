import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LiveTraffic } from "../live-traffic"
import type { LiveStats } from "@/lib/stats/store"

const initial: LiveStats = { online: 3, signedIn: 1, guests: 2, pages: [{ path: "/browse", visitors: 2 }], at: "2026-10-11T10:00:00.000Z" }
const later: LiveStats = { online: 5, signedIn: 2, guests: 3, pages: [{ path: "/lang/[slug]", visitors: 4 }], at: "2026-10-11T10:00:15.000Z" }

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe("LiveTraffic", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows the server's counts, then refreshes them every 15 seconds", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(later), { status: 200 }))
    render(<LiveTraffic initial={initial} />)
    expect(screen.getByTestId("live-online")).toHaveTextContent("3")
    expect(screen.getByText("/browse")).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(15_000) })
    await flush()
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stats/live", expect.objectContaining({ cache: "no-store" }))
    expect(screen.getByTestId("live-online")).toHaveTextContent("5")
    expect(screen.getByText("/lang/[slug]")).toBeInTheDocument()
  })

  it("keeps the last counts and says so when a refresh fails", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }))
    render(<LiveTraffic initial={initial} />)
    await act(async () => { vi.advanceTimersByTime(15_000) })
    await flush()
    expect(screen.getByTestId("live-online")).toHaveTextContent("3")
    expect(screen.getByRole("status")).toHaveTextContent(/could not refresh/i)
  })

  it("stops polling once the admin session is gone", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }))
    render(<LiveTraffic initial={initial} />)
    await act(async () => { vi.advanceTimersByTime(15_000) })
    await flush()
    expect(screen.getByRole("status")).toHaveTextContent(/session has ended/i)
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("ignores an answer that arrives after a newer one", async () => {
    let answerFirst: (r: Response) => void = () => {}
    fetchMock
      .mockReturnValueOnce(new Promise<Response>((resolve) => { answerFirst = resolve }))
      .mockResolvedValueOnce(new Response(JSON.stringify(later), { status: 200 }))
    render(<LiveTraffic initial={initial} />)
    await act(async () => { vi.advanceTimersByTime(15_000) })
    await act(async () => { vi.advanceTimersByTime(15_000) })
    await flush()
    expect(screen.getByTestId("live-online")).toHaveTextContent("5")
    await act(async () => { answerFirst(new Response(JSON.stringify({ ...initial, online: 1 }), { status: 200 })) })
    await flush()
    expect(screen.getByTestId("live-online")).toHaveTextContent("5")
  })

  it("does not poll while the tab is hidden", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
    render(<LiveTraffic initial={initial} />)
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
