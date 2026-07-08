import { describe, it, expect, beforeEach } from "vitest"
import { rateLimit, pruneRateLimits, __resetRateLimits } from "@/lib/rate-limit"

beforeEach(() => __resetRateLimits())

describe("rateLimit", () => {
  it("allows up to `limit` hits in a window, then blocks", () => {
    const key = "u1:action"
    expect(rateLimit(key, 3, 1000, 0).ok).toBe(true)
    expect(rateLimit(key, 3, 1000, 10).ok).toBe(true)
    expect(rateLimit(key, 3, 1000, 20).ok).toBe(true)
    const blocked = rateLimit(key, 3, 1000, 30)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBe(970) // resetAt (1000) - now (30)
  })

  it("resets after the window elapses", () => {
    const key = "u1:action"
    rateLimit(key, 1, 1000, 0)
    expect(rateLimit(key, 1, 1000, 500).ok).toBe(false)
    expect(rateLimit(key, 1, 1000, 1000).ok).toBe(true) // new window
  })

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(true)
    expect(rateLimit("a", 1, 1000, 1).ok).toBe(false)
    expect(rateLimit("b", 1, 1000, 1).ok).toBe(true) // different key, own budget
  })

  it("reports remaining budget", () => {
    expect(rateLimit("k", 5, 1000, 0).remaining).toBe(4)
    expect(rateLimit("k", 5, 1000, 1).remaining).toBe(3)
  })

  it("prune removes expired windows", () => {
    rateLimit("old", 1, 100, 0)
    pruneRateLimits(1000)
    // After prune the window is gone, so a fresh hit is allowed again.
    expect(rateLimit("old", 1, 100, 1000).ok).toBe(true)
  })
})
