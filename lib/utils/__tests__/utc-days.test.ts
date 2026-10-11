// @vitest-environment node
import { describe, expect, it } from "vitest"
import { lastUtcDays, utcDayLabel } from "../utc-days"

describe("lastUtcDays", () => {
  it("lists the last N UTC calendar days, oldest first, today included", () => {
    expect(lastUtcDays(3, new Date("2026-10-11T23:30:00Z"))).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"])
    expect(lastUtcDays(2, new Date("2026-03-01T00:00:00Z"))).toEqual(["2026-02-28", "2026-03-01"])
  })
})

describe("utcDayLabel", () => {
  it("labels the day itself, whatever the server's time zone", () => {
    expect(utcDayLabel("2026-10-11")).toBe("Oct 11")
    expect(utcDayLabel("2026-01-01")).toBe("Jan 1")
  })
})
