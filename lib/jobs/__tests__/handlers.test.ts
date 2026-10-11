import { describe, it, expect, beforeEach, vi } from "vitest"
import { registerHandler, getHandler, clearHandlers, registerBuiltinHandlers } from "@/lib/jobs/handlers"

beforeEach(() => {
  clearHandlers()
})

describe("handler registry", () => {
  it("registers and retrieves a handler", () => {
    const handler = async () => {}
    registerHandler("league_rollover", handler)
    expect(getHandler("league_rollover")).toBe(handler)
  })

  it("returns null for unknown types", () => {
    expect(getHandler("nope")).toBeNull()
  })

  it("throws on duplicate registration to catch wiring mistakes", () => {
    registerHandler("x", async () => {})
    expect(() => registerHandler("x", async () => {})).toThrow(/already registered/)
  })

  it("registers the heartbeat builtin", async () => {
    registerBuiltinHandlers()
    const heartbeat = getHandler("heartbeat")
    expect(heartbeat).not.toBeNull()
    await expect(heartbeat!({})).resolves.toBeUndefined()
  })

  it("registers the hourly anonymous-statistics rollup", async () => {
    const rollupAndPrune = vi.fn(async () => ({ rolledUp: 1, pruned: 0 }))
    vi.doMock("@/lib/stats/store", () => ({ rollupAndPrune }))
    try {
      registerBuiltinHandlers()
      await getHandler("stats_rollup")!({})
      expect(rollupAndPrune).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock("@/lib/stats/store")
    }
  })
})
