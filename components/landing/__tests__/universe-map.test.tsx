import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const graph = vi.hoisted(() => ({ pauseAnimation: vi.fn(), resumeAnimation: vi.fn() }))
vi.mock("next/dynamic", async () => {
  const React = await import("react")
  return { default: () => React.forwardRef(function Graph(_props, ref) {
    React.useImperativeHandle(ref, () => graph)
    return <div />
  }) }
})
import { LingoConUniverseMap } from "../universe-map"

let visibility: (visible: boolean) => void
const images: { src: string; onload: (() => void) | null; onerror: (() => void) | null; removeAttribute: ReturnType<typeof vi.fn> }[] = []
beforeEach(() => {
  vi.clearAllMocks()
  images.length = 0
  vi.stubGlobal("Image", class {
    src = ""
    onload = null
    onerror = null
    removeAttribute = vi.fn()
    constructor() { images.push(this) }
  })
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      visibility = visible => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as never)
    }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal("ResizeObserver", class { observe() {}; disconnect() {} })
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as any).clientWidth
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
})
const languages = Array.from({ length: 6 }, (_, id) => ({
  id: String(id), name: `Language ${id}`, slug: String(id),
  flagUrl: `/uploads/flag/${id}.webp`, parentLanguageId: null,
  owner: { name: null }, _count: { dictionaryEntries: 0 },
}))

describe("homepage map resources", () => {
  it("limits concurrent thumbnail loads and releases image references on unmount", () => {
    const { unmount } = render(<LingoConUniverseMap languages={languages} />)
    expect(images).toHaveLength(4)
    expect(images.every(img => img.src.startsWith("/_next/image?"))).toBe(true)
    act(() => images[0].onload?.())
    expect(images).toHaveLength(5)
    act(() => images[1].onerror?.())
    expect(images).toHaveLength(6)
    unmount()
    expect(images.every(img => img.onload === null && img.onerror === null)).toBe(true)
    expect(images.every(img => img.removeAttribute.mock.calls.some(([name]) => name === "src"))).toBe(true)
  })
  it("pauses outside the viewport and when the tab is hidden", () => {
    render(<LingoConUniverseMap languages={languages} />)
    expect(graph.pauseAnimation).toHaveBeenCalled()
    act(() => visibility(true))
    expect(graph.resumeAnimation).toHaveBeenCalled()
    act(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(graph.pauseAnimation).toHaveBeenLastCalledWith()
    act(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
      document.dispatchEvent(new Event("visibilitychange"))
      visibility(false)
    })
    expect(graph.pauseAnimation.mock.invocationCallOrder.at(-1)).toBeGreaterThan(graph.resumeAnimation.mock.invocationCallOrder.at(-1)!)
  })
})
