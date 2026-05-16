import { describe, it, expect } from "vitest"
import { parseParadigmSlots, paradigmSlotsSchema } from "../paradigm"

describe("parseParadigmSlots", () => {
  it("parses a well-formed slots object", () => {
    const input = {
      rows: ["Singular", "Plural"],
      columns: ["Nominative", "Accusative"],
      cells: { "0-0": "katu", "0-1": "katun", "1-0": "katui", "1-1": "katuin" },
    }
    const result = parseParadigmSlots(input)
    expect(result.rows).toEqual(["Singular", "Plural"])
    expect(result.columns).toEqual(["Nominative", "Accusative"])
    expect(result.cells["0-0"]).toBe("katu")
  })

  it("returns safe defaults for null", () => {
    const result = parseParadigmSlots(null)
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.cells).toEqual({})
  })

  it("returns safe defaults for missing fields", () => {
    const result = parseParadigmSlots({})
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.cells).toEqual({})
  })

  it("returns safe defaults for wrong shape", () => {
    const result = parseParadigmSlots("not an object")
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.cells).toEqual({})
  })

  it("returns safe defaults for partially invalid data (rows not array)", () => {
    const result = parseParadigmSlots({ rows: "Singular", columns: ["Nom"], cells: {} })
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.cells).toEqual({})
  })

  it("handles empty arrays", () => {
    const result = parseParadigmSlots({ rows: [], columns: [], cells: {} })
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.cells).toEqual({})
  })
})

describe("paradigmSlotsSchema", () => {
  it("applies defaults when fields are missing", () => {
    const result = paradigmSlotsSchema.parse({})
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.cells).toEqual({})
  })

  it("accepts valid input", () => {
    const result = paradigmSlotsSchema.parse({
      rows: ["SG", "PL"],
      columns: ["NOM"],
      cells: { "0-0": "va", "1-0": "vai" },
    })
    expect(result.rows).toHaveLength(2)
    expect(result.cells["1-0"]).toBe("vai")
  })
})
