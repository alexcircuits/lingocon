import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))

import { __resetCookieNotice, COOKIE_NOTICE_DISMISSED_EVENT, COOKIE_NOTICE_KEY, CookieNotice, isCookieNoticeDismissed } from "../cookie-notice"

describe("CookieNotice", () => {
  beforeEach(() => {
    localStorage.clear()
    __resetCookieNotice()
  })

  it("tells a first-time visitor which cookies are used, with a link to the details", async () => {
    render(<CookieNotice />)
    const notice = await screen.findByRole("region", { name: "label" })
    expect(notice).toHaveTextContent("message")
    expect(screen.getByRole("link", { name: "learnMore" })).toHaveAttribute("href", "/cookies")
  })

  it("stays closed once dismissed, and tells waiting banners", async () => {
    const onDismissed = vi.fn()
    window.addEventListener(COOKIE_NOTICE_DISMISSED_EVENT, onDismissed)
    render(<CookieNotice />)
    fireEvent.click(await screen.findByRole("button", { name: "dismiss" }))
    expect(screen.queryByRole("region", { name: "label" })).not.toBeInTheDocument()
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe("1")
    expect(isCookieNoticeDismissed()).toBe(true)
    expect(onDismissed).toHaveBeenCalledTimes(1)
    window.removeEventListener(COOKIE_NOTICE_DISMISSED_EVENT, onDismissed)
  })

  it("is not shown to someone who already dismissed it", async () => {
    localStorage.setItem(COOKIE_NOTICE_KEY, "1")
    render(<CookieNotice />)
    await act(async () => {})
    expect(screen.queryByRole("region", { name: "label" })).not.toBeInTheDocument()
  })

  it("still works when storage is blocked", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    try {
      render(<CookieNotice />)
      fireEvent.click(await screen.findByRole("button", { name: "dismiss" }))
      expect(screen.queryByRole("region", { name: "label" })).not.toBeInTheDocument()
      // Banners mounted later on this page still know it was closed.
      expect(isCookieNoticeDismissed()).toBe(true)
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})
