import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-recovery"

describe("isChunkLoadError", () => {
  it.each([
    [{ name: "ChunkLoadError", message: "Loading chunk 123 failed." }],
    [new Error("Loading chunk app/studio-x failed.")],
    [new Error("Loading CSS chunk 42 failed. (/_next/static/css/a.css)")],
    [{ name: "Error", message: "CSS_CHUNK_LOAD_FAILED" }],
    [new TypeError("Failed to fetch dynamically imported module: /_next/static/chunks/x.js")],
    [new TypeError("Importing a module script failed.")],
    ["ChunkLoadError: Loading chunk 9 failed."],
  ])("recognizes %o", (error) => {
    expect(isChunkLoadError(error)).toBe(true)
  })

  it.each([[new Error("Network request failed")], [null], [undefined], [{ message: "Unauthorized" }], [42]])(
    "ignores unrelated error %o",
    (error) => {
      expect(isChunkLoadError(error)).toBe(false)
    }
  )
})

describe("reloadOnceForChunkError", () => {
  const reload = vi.fn()
  beforeEach(() => {
    window.sessionStorage.clear()
    reload.mockReset()
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } })
  })
  afterEach(() => window.sessionStorage.clear())

  it("reloads once and then refuses to loop within the guard window", () => {
    expect(reloadOnceForChunkError(1_000_000)).toBe(true)
    expect(reloadOnceForChunkError(1_000_000 + 5_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("does not reload while offline: the chunk is unreachable, not stale, and a reload would drop the page", () => {
    const onLine = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false)
    try {
      expect(reloadOnceForChunkError(1_000_000)).toBe(false)
      expect(reload).not.toHaveBeenCalled()
    } finally {
      onLine.mockRestore()
    }
    // Back online, the next failure may recover (no guard marker was written).
    expect(reloadOnceForChunkError(1_000_000 + 1_000)).toBe(true)
  })

  it("allows another recovery after the guard window", () => {
    expect(reloadOnceForChunkError(1_000_000)).toBe(true)
    expect(reloadOnceForChunkError(1_000_000 + 31_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
