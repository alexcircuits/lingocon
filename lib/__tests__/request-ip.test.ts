import { describe, it, expect } from "vitest"
import { clientIpFromHeaders, normalizeEmail } from "../request-ip"

describe("clientIpFromHeaders", () => {
  it("prefers X-Real-IP", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4")
  })

  it("uses the proxy-appended (last) X-Forwarded-For hop, not the spoofable first one", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 5.5.5.5" }))).toBe("5.5.5.5")
  })

  it("falls back to a shared bucket", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown")
  })
})

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com")
  })
})
