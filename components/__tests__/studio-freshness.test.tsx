import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { StudioFreshness, STALE_AFTER_HIDDEN_MS } from "../studio-freshness"

vi.mock("sonner", () => ({ toast: vi.fn() }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
  document.dispatchEvent(new Event("visibilitychange"))
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online })
}

describe("StudioFreshness", () => {
  const refresh = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockReset()
    vi.mocked(toast).mockReset()
    setOnline(true)
    vi.mocked(useRouter).mockReturnValue({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() } as never)
  })
  afterEach(() => vi.useRealTimers())

  it("offers a refresh after the tab was hidden for a while, without refreshing on its own", () => {
    render(<StudioFreshness />)
    act(() => setVisibility("hidden"))
    vi.advanceTimersByTime(STALE_AFTER_HIDDEN_MS + 1)
    act(() => setVisibility("visible"))
    // Never automatic: a refresh can become a full reload (new deployment, flaky
    // network) and that would discard unsaved editor drafts.
    expect(refresh).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledTimes(1)
    const options = vi.mocked(toast).mock.calls[0][1] as { action: { onClick: () => void } }
    act(() => options.action.onClick())
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("stays quiet after a brief switch away", () => {
    render(<StudioFreshness />)
    act(() => setVisibility("hidden"))
    vi.advanceTimersByTime(5_000)
    act(() => setVisibility("visible"))
    expect(toast).not.toHaveBeenCalled()
  })

  it("stays quiet while offline", () => {
    render(<StudioFreshness />)
    act(() => setVisibility("hidden"))
    vi.advanceTimersByTime(STALE_AFTER_HIDDEN_MS + 1)
    setOnline(false)
    act(() => setVisibility("visible"))
    expect(toast).not.toHaveBeenCalled()
  })

  it("does nothing on a visible event without a prior hide", () => {
    render(<StudioFreshness />)
    act(() => setVisibility("visible"))
    expect(toast).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
