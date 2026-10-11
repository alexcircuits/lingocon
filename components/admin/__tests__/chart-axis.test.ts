// @vitest-environment node
import { describe, expect, it } from "vitest"
import { yAxisWidth } from "../chart-axis"

describe("yAxisWidth", () => {
  it("keeps the narrow axis for small counts", () => {
    expect(yAxisWidth([{ v: 4 }, { v: 12 }], ["v"])).toBe(38)
  })

  it("widens the axis so 3- and 4-digit ticks are not clipped", () => {
    expect(yAxisWidth([{ v: 180 }], ["v"])).toBeGreaterThan(yAxisWidth([{ v: 12 }], ["v"]))
    expect(yAxisWidth([{ a: 3038, b: 1 }], ["a", "b"])).toBe(52)
  })

  it("ignores non-numeric values", () => {
    expect(yAxisWidth([{ v: "Oct 11" }], ["v"])).toBe(31)
  })
})
