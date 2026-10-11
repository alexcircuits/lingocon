// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { __resetThrottle, DAILY_PAGEVIEW_CAP, planWrite } from "../throttle"

const T0 = Date.UTC(2026, 9, 11, 10, 0, 0)

describe("planWrite", () => {
  beforeEach(() => __resetThrottle())

  it("writes a first page view and its presence", () => {
    expect(planWrite("pageview", "k1", "/browse", T0)).toEqual({ presence: true, pageView: true })
  })

  it("drops a repeat of the same page by the same visitor within 5 seconds (reload spam)", () => {
    planWrite("pageview", "k1", "/browse", T0)
    expect(planWrite("pageview", "k1", "/browse", T0 + 2_000)).toEqual({ presence: false, pageView: false })
    expect(planWrite("pageview", "k1", "/search", T0 + 2_500)).toEqual({ presence: true, pageView: true })
    expect(planWrite("pageview", "k1", "/browse", T0 + 9_000)).toEqual({ presence: true, pageView: true })
    expect(planWrite("pageview", "k2", "/browse", T0 + 9_000)).toEqual({ presence: true, pageView: true })
  })

  it("skips a presence write when the visitor was seen on that page in the last 15 seconds", () => {
    planWrite("pageview", "k1", "/browse", T0)
    expect(planWrite("ping", "k1", "/browse", T0 + 10_000)).toEqual({ presence: false, pageView: false })
    expect(planWrite("ping", "k1", "/browse", T0 + 25_000)).toEqual({ presence: true, pageView: false })
    expect(planWrite("ping", "k1", "/search", T0 + 26_000)).toEqual({ presence: true, pageView: false })
  })

  it("stops storing page views after the daily cap, keeping presence, and starts again the next day", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    for (let i = 0; i < DAILY_PAGEVIEW_CAP; i++) planWrite("pageview", `v${i}`, "/browse", T0)
    expect(planWrite("pageview", "late", "/browse", T0)).toEqual({ presence: true, pageView: false })
    expect(planWrite("pageview", "later", "/browse", T0)).toEqual({ presence: true, pageView: false })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(planWrite("pageview", "late", "/browse", T0 + 86_400_000)).toEqual({ presence: true, pageView: true })
    warn.mockRestore()
  })
})
