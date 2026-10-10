import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useRevealCreatedEntry } from "../use-reveal-created-entry"

type Entry = { id: string }

let scopeCounter = 0
function setup(initial: Entry[]) {
  const scope = `scope-${++scopeCounter}`
  const reveal = vi.fn()
  const hook = renderHook(({ entries }) => useRevealCreatedEntry(scope, entries, reveal), {
    initialProps: { entries: initial },
  })
  return { scope, reveal, hook }
}

describe("useRevealCreatedEntry", () => {
  it("does nothing when the re-rendered page shows the new entry", () => {
    const { reveal, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    act(() => hook.result.current.settle(token, "new"))
    hook.rerender({ entries: [{ id: "new" }, { id: "a" }] })
    expect(reveal).not.toHaveBeenCalled()
  })

  it("reveals the entry when the re-rendered page does not contain it (other page, filter or sort)", () => {
    const { reveal, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    act(() => hook.result.current.settle(token, "new"))
    hook.rerender({ entries: [{ id: "a" }, { id: "b" }] })
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it("decides immediately when the server re-render arrived before the action resolved", () => {
    const { reveal, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    hook.rerender({ entries: [{ id: "a" }, { id: "b" }] }) // action response committed first
    act(() => hook.result.current.settle(token, "new"))
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it("decides immediately (no reveal) when the early re-render already shows it", () => {
    const { reveal, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    hook.rerender({ entries: [{ id: "new" }, { id: "a" }] })
    act(() => hook.result.current.settle(token, "new"))
    hook.rerender({ entries: [{ id: "x" }] }) // later unrelated navigation
    expect(reveal).not.toHaveBeenCalled()
  })

  it("only acts once per created entry", () => {
    const { reveal, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    act(() => hook.result.current.settle(token, "new"))
    hook.rerender({ entries: [{ id: "b" }] })
    hook.rerender({ entries: [{ id: "c" }] })
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it("still reveals when the save's re-render remounts the component (settle first)", () => {
    const { scope, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    act(() => hook.result.current.settle(token, "new"))
    hook.unmount()
    // The revalidated page mounts a fresh instance with the new entries.
    const reveal = vi.fn()
    renderHook(() => useRevealCreatedEntry(scope, [{ id: "a" }, { id: "b" }], reveal))
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it("still reveals when the remount happens before the action resolves (settle last)", () => {
    const { scope, hook } = setup([{ id: "a" }])
    const token = hook.result.current.begin()
    const settleFromOldInstance = hook.result.current.settle
    hook.unmount()
    const reveal = vi.fn()
    renderHook(() => useRevealCreatedEntry(scope, [{ id: "a" }, { id: "b" }], reveal))
    act(() => settleFromOldInstance(token, "new"))
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it("forgets a pending reveal that never settled, so a later page change is not hijacked", () => {
    vi.useFakeTimers()
    try {
      const { reveal, hook } = setup([{ id: "a" }])
      const token = hook.result.current.begin()
      act(() => hook.result.current.settle(token, "new"))
      vi.advanceTimersByTime(30_000) // the save's re-render never arrived
      hook.rerender({ entries: [{ id: "page-2" }] }) // user paginates later
      expect(reveal).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps projects separate", () => {
    const first = setup([{ id: "a" }])
    const second = setup([{ id: "z" }])
    const token = first.hook.result.current.begin()
    act(() => first.hook.result.current.settle(token, "new"))
    second.hook.rerender({ entries: [{ id: "y" }] })
    expect(second.reveal).not.toHaveBeenCalled()
    expect(first.reveal).not.toHaveBeenCalled()
  })
})
