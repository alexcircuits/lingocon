import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const cobe = vi.hoisted(() => ({ toggle: vi.fn(), destroy: vi.fn() }))
vi.mock("cobe", () => ({ default: vi.fn(() => cobe) }))
import { Globe } from "../globe"

let observe: (visible: boolean) => void = () => {}
beforeEach(() => {
  vi.clearAllMocks()
  globalThis.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      observe = (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as never)
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() { return [] }
  } as unknown as typeof IntersectionObserver
  globalThis.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never
})
afterEach(() => {
  cleanup()
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
})

const setTabVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true })
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("Globe", () => {
  // Rendering every frame kept a CPU core busy (82% of the main thread without GPU acceleration),
  // even scrolled out of view or in a background tab.
  it("renders only while it is on screen", () => {
    render(<Globe />)
    act(() => observe(false))
    expect(cobe.toggle).toHaveBeenLastCalledWith(false)
    act(() => observe(true))
    expect(cobe.toggle).toHaveBeenLastCalledWith(true)
  })

  it("stops while the tab is hidden and resumes when it is shown again", () => {
    render(<Globe />)
    act(() => observe(true))
    act(() => setTabVisibility("hidden"))
    expect(cobe.toggle).toHaveBeenLastCalledWith(false)
    act(() => setTabVisibility("visible"))
    expect(cobe.toggle).toHaveBeenLastCalledWith(true)
  })

  it("stops rendering when it unmounts", () => {
    const { unmount } = render(<Globe />)
    unmount()
    expect(cobe.destroy).toHaveBeenCalled()
  })
})
