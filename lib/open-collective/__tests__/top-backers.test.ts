import { unstable_cache } from "next/cache"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fetchTopBackers: vi.fn() }))
vi.mock("../fetch-backers", () => ({ fetchTopBackers: mocks.fetchTopBackers }))

import {
  BACKERS_REVALIDATE_SECONDS,
  OPEN_COLLECTIVE_RETRY_COOLDOWN_MS,
  OPEN_COLLECTIVE_SLUG,
  TOP_BACKERS_LIMIT,
} from "../constants"
import { getTopBackers } from "../top-backers"

// Captured at import time, before any test can clear the mock's call log.
const cacheRegistration = vi.mocked(unstable_cache).mock.calls.at(-1)

const backer = { name: "Ada", kind: "individual", profileUrl: "https://opencollective.com/ada", imageUrl: null, totalCents: 6400 }

// Each test starts well past any cooldown a previous test's failure left behind.
let clock = Date.UTC(2026, 10, 18)

describe("getTopBackers", () => {
  let errorLog: ReturnType<typeof vi.spyOn>
  let warnLog: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clock += 10 * OPEN_COLLECTIVE_RETRY_COOLDOWN_MS
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(clock)
    mocks.fetchTopBackers.mockReset()
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    warnLog = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    errorLog.mockRestore()
    warnLog.mockRestore()
  })

  it("returns the backers for LingoCon's collective", async () => {
    mocks.fetchTopBackers.mockResolvedValue({ currency: "EUR", backers: [backer], skipped: 0 })

    await expect(getTopBackers()).resolves.toEqual({ status: "ok", currency: "EUR", backers: [backer] })
    expect(mocks.fetchTopBackers).toHaveBeenCalledWith({ slug: OPEN_COLLECTIVE_SLUG, limit: TOP_BACKERS_LIMIT })
    expect(errorLog).not.toHaveBeenCalled()
  })

  it("reports an empty collective as ok with no backers", async () => {
    mocks.fetchTopBackers.mockResolvedValue({ currency: "EUR", backers: [], skipped: 0 })

    await expect(getTopBackers()).resolves.toEqual({ status: "ok", currency: "EUR", backers: [] })
  })

  it("logs and reports 'unavailable' instead of throwing when Open Collective fails", async () => {
    const failure = new Error("Open Collective API responded with HTTP 503")
    mocks.fetchTopBackers.mockRejectedValue(failure)

    await expect(getTopBackers()).resolves.toEqual({ status: "unavailable" })
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("[open-collective]"), failure)
  })

  it("during an outage, asks Open Collective and logs once per cooldown, not once per page view", async () => {
    mocks.fetchTopBackers.mockRejectedValue(new Error("Open Collective API responded with HTTP 503"))

    await expect(getTopBackers()).resolves.toEqual({ status: "unavailable" })
    await expect(getTopBackers()).resolves.toEqual({ status: "unavailable" })
    await expect(getTopBackers()).resolves.toEqual({ status: "unavailable" })
    expect(mocks.fetchTopBackers).toHaveBeenCalledTimes(1)
    expect(errorLog).toHaveBeenCalledTimes(1)

    vi.setSystemTime(clock + OPEN_COLLECTIVE_RETRY_COOLDOWN_MS)
    mocks.fetchTopBackers.mockResolvedValue({ currency: "EUR", backers: [backer], skipped: 0 })
    await expect(getTopBackers()).resolves.toMatchObject({ status: "ok" })
    expect(mocks.fetchTopBackers).toHaveBeenCalledTimes(2)
  })

  it("warns when the API returned members it had to skip", async () => {
    mocks.fetchTopBackers.mockResolvedValue({ currency: "EUR", backers: [backer], skipped: 3 })

    await expect(getTopBackers()).resolves.toMatchObject({ status: "ok" })
    expect(warnLog).toHaveBeenCalledWith(expect.stringMatching(/\[open-collective\].*3/))
  })

  // Registration only: the cache itself is Next's and is mocked to a pass-through here.
  it("registers the lookup with Next's data cache for an hour", () => {
    expect(BACKERS_REVALIDATE_SECONDS).toBe(3600)
    expect(cacheRegistration).toBeDefined()
    const [, keyParts, cacheOptions] = cacheRegistration!
    expect(keyParts).toEqual(expect.arrayContaining([OPEN_COLLECTIVE_SLUG]))
    expect(cacheOptions).toMatchObject({ revalidate: BACKERS_REVALIDATE_SECONDS })
  })
})
