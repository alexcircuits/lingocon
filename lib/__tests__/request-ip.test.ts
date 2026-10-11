import { describe, it, expect } from "vitest"
import { clientIpFromHeaders, ipRateLimitKey, normalizeEmail } from "../request-ip"

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

describe("ipRateLimitKey", () => {
  it("keeps an IPv4 address as it is", () => {
    expect(ipRateLimitKey("203.0.113.9")).toBe("203.0.113.9")
    expect(ipRateLimitKey("unknown")).toBe("unknown")
  })

  it("groups an IPv6 address by its /64, which one client typically controls whole", () => {
    expect(ipRateLimitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64")
    expect(ipRateLimitKey("2001:DB8:1:2::1")).toBe("2001:db8:1:2::/64")
    expect(ipRateLimitKey("2001:db8::ffff")).toBe("2001:db8:0:0::/64")
    expect(ipRateLimitKey("::1")).toBe("0:0:0:0::/64")
  })

  it("treats an IPv4-mapped IPv6 address as the IPv4 address", () => {
    expect(ipRateLimitKey("::ffff:203.0.113.9")).toBe("203.0.113.9")
  })
})

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com")
  })
})
