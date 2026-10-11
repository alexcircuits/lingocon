// @vitest-environment node
import { describe, expect, it } from "vitest"
import { deviceClass, isBot, referrerHost, utcDay, visitorKey } from "../visitor"

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

describe("isBot", () => {
  it("recognises crawlers, link previews and headless browsers", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 HeadlessChrome/130.0 Safari/537.36",
      "curl/8.4.0",
      "",
    ]) {
      expect(isBot(ua), ua).toBe(true)
    }
  })

  it("does not flag ordinary browsers", () => {
    for (const ua of [CHROME, IPHONE, ANDROID_PHONE, IPAD]) expect(isBot(ua), ua).toBe(false)
  })
})

describe("deviceClass", () => {
  it("tells phones, tablets and desktops apart", () => {
    expect(deviceClass(IPHONE)).toBe("mobile")
    expect(deviceClass(ANDROID_PHONE)).toBe("mobile")
    expect(deviceClass(IPAD)).toBe("tablet")
    expect(deviceClass(ANDROID_TABLET)).toBe("tablet")
    expect(deviceClass(CHROME)).toBe("desktop")
  })
})

describe("referrerHost", () => {
  it("keeps only the host of an external referrer", () => {
    expect(referrerHost("https://www.reddit.com/r/conlangs/comments/abc?utm=1", "lingocon.com")).toBe("reddit.com")
    expect(referrerHost("https://duckduckgo.com/", "lingocon.com")).toBe("duckduckgo.com")
  })

  it("drops internal, missing and malformed referrers", () => {
    expect(referrerHost("https://lingocon.com/browse", "lingocon.com")).toBeNull()
    expect(referrerHost("https://www.lingocon.com/browse", "lingocon.com")).toBeNull()
    // The Host header carries the port when it is not the default one.
    expect(referrerHost("http://localhost:3100/browse", "localhost:3100")).toBeNull()
    expect(referrerHost("", "lingocon.com")).toBeNull()
    expect(referrerHost(null, "lingocon.com")).toBeNull()
    expect(referrerHost("not a url", "lingocon.com")).toBeNull()
    expect(referrerHost("javascript:alert(1)", "lingocon.com")).toBeNull()
  })
})

describe("visitorKey", () => {
  it("is a fixed-length hash that does not contain the IP", () => {
    const key = visitorKey("salt-a", "203.0.113.7", CHROME)
    expect(key).toMatch(/^[0-9a-f]{32}$/)
    expect(key).not.toContain("203")
  })

  it("is stable within a day and different with the next day's salt", () => {
    expect(visitorKey("salt-a", "203.0.113.7", CHROME)).toBe(visitorKey("salt-a", "203.0.113.7", CHROME))
    expect(visitorKey("salt-b", "203.0.113.7", CHROME)).not.toBe(visitorKey("salt-a", "203.0.113.7", CHROME))
  })

  it("tells visitors apart by IP and browser", () => {
    const a = visitorKey("salt-a", "203.0.113.7", CHROME)
    expect(visitorKey("salt-a", "203.0.113.8", CHROME)).not.toBe(a)
    expect(visitorKey("salt-a", "203.0.113.7", IPHONE)).not.toBe(a)
  })
})

describe("utcDay", () => {
  it("is the UTC calendar day, whatever the server's time zone", () => {
    expect(utcDay(new Date("2026-10-11T23:59:59.999Z")).toISOString()).toBe("2026-10-11T00:00:00.000Z")
    expect(utcDay(new Date("2026-10-12T00:00:00.000Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z")
  })
})
