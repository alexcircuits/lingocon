import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useOpenedOnce } from "../use-opened-once"

describe("useOpenedOnce", () => {
  it("stays false while the dialog has never been opened", () => {
    const { result, rerender } = renderHook(({ open }) => useOpenedOnce(open), { initialProps: { open: false } })
    expect(result.current).toBe(false)
    rerender({ open: false })
    expect(result.current).toBe(false)
  })

  it("turns true in the render that opens it and stays true after closing", () => {
    const { result, rerender } = renderHook(({ open }) => useOpenedOnce(open), { initialProps: { open: false } })
    rerender({ open: true })
    expect(result.current).toBe(true)
    rerender({ open: false })
    expect(result.current).toBe(true)
  })

  it("is true immediately when the dialog starts open", () => {
    const { result } = renderHook(() => useOpenedOnce(true))
    expect(result.current).toBe(true)
  })
})
