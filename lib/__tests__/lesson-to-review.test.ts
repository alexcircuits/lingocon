import { describe, it, expect } from "vitest"
import { resultToRating } from "../lesson-to-review"

describe("resultToRating", () => {
  it("maps an incorrect answer to AGAIN regardless of perfection", () => {
    expect(resultToRating(false, false)).toBe("AGAIN")
    expect(resultToRating(false, true)).toBe("AGAIN")
  })

  it("maps a correct answer in a non-perfect lesson to GOOD", () => {
    expect(resultToRating(true, false)).toBe("GOOD")
  })

  it("maps a correct answer in a flawless lesson to EASY", () => {
    expect(resultToRating(true, true)).toBe("EASY")
  })

  it("maps a correct-but-retried answer to HARD (a mistake beats EASY/GOOD)", () => {
    expect(resultToRating(true, false, true)).toBe("HARD")
    expect(resultToRating(true, true, true)).toBe("HARD")
  })

  it("still returns AGAIN for an incorrect answer even if retried", () => {
    expect(resultToRating(false, false, true)).toBe("AGAIN")
  })

  it("defaults to no-retry behavior when the flag is omitted (back-compat)", () => {
    expect(resultToRating(true, false)).toBe("GOOD")
    expect(resultToRating(true, true)).toBe("EASY")
  })
})
