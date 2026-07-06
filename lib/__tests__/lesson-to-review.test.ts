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
})
