import { describe, expect, it, vi } from "vitest"
import { LookupCoolingDownError, createGuardedLookup } from "../guarded-lookup"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("createGuardedLookup", () => {
  it("passes the result through", async () => {
    const guarded = createGuardedLookup(async () => "value", { cooldownMs: 1000 })

    await expect(guarded()).resolves.toBe("value")
  })

  it("shares one lookup between callers that arrive while it is in flight", async () => {
    const pending = deferred<string>()
    const lookup = vi.fn(() => pending.promise)
    const guarded = createGuardedLookup(lookup, { cooldownMs: 1000 })

    const first = guarded()
    const second = guarded()
    pending.resolve("value")

    await expect(Promise.all([first, second])).resolves.toEqual(["value", "value"])
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it("starts a fresh lookup once the previous one has settled", async () => {
    const lookup = vi.fn(async () => "value")
    const guarded = createGuardedLookup(lookup, { cooldownMs: 1000 })

    await guarded()
    await guarded()

    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it("after a failure, fails fast without calling the lookup until the cooldown has passed", async () => {
    let now = 10_000
    const failure = new Error("HTTP 503")
    const lookup = vi.fn<() => Promise<string>>().mockRejectedValueOnce(failure).mockResolvedValue("recovered")
    const guarded = createGuardedLookup(lookup, { cooldownMs: 60_000, now: () => now })

    await expect(guarded()).rejects.toBe(failure)

    now += 59_999
    await expect(guarded()).rejects.toBeInstanceOf(LookupCoolingDownError)
    expect(lookup).toHaveBeenCalledTimes(1)

    now += 1
    await expect(guarded()).resolves.toBe("recovered")
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it("treats a lookup that throws synchronously like any other failure", async () => {
    const guarded = createGuardedLookup<string>(
      () => {
        throw new Error("boom")
      },
      { cooldownMs: 1000, now: () => 0 },
    )

    await expect(guarded()).rejects.toThrow("boom")
    await expect(guarded()).rejects.toBeInstanceOf(LookupCoolingDownError)
  })
})
