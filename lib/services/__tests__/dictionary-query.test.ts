import { describe, it, expect } from "vitest"
import {
  buildDictionarySearchWhere,
  dictionaryOrderBy,
  parsePage,
  parseQuery,
  parseSearchField,
  parseSort,
} from "../dictionary-query"

describe("parseSearchField", () => {
  it("accepts the searchable columns", () => {
    expect(parseSearchField("lemma")).toBe("lemma")
    expect(parseSearchField("tags")).toBe("tags")
  })

  it("rejects anything else, including columns that would widen the query", () => {
    expect(parseSearchField("languageId")).toBeUndefined()
    expect(parseSearchField("id")).toBeUndefined()
    expect(parseSearchField("all")).toBeUndefined()
    expect(parseSearchField("")).toBeUndefined()
    expect(parseSearchField(undefined)).toBeUndefined()
  })
})

describe("buildDictionarySearchWhere", () => {
  it("always scopes to the language being viewed", () => {
    for (const field of [undefined, "lemma", "gloss", "ipa", "partOfSpeech", "tags"] as const) {
      expect(buildDictionarySearchWhere("lang-1", "abc", field).languageId).toBe("lang-1")
    }
    expect(buildDictionarySearchWhere("lang-1", "")).toEqual({ languageId: "lang-1" })
  })

  it("cannot be steered to another language through the field parameter", () => {
    const where = buildDictionarySearchWhere("lang-1", "other-lang", parseSearchField("languageId"))
    expect(where.languageId).toBe("lang-1")
  })

  it("searches one column when a field is chosen", () => {
    expect(buildDictionarySearchWhere("l", "kar", "gloss")).toEqual({
      languageId: "l",
      gloss: { contains: "kar", mode: "insensitive" },
    })
  })

  it("matches tags exactly, lower-cased", () => {
    expect(buildDictionarySearchWhere("l", "Food", "tags")).toEqual({
      languageId: "l",
      tags: { array_contains: ["food"] },
    })
  })
})

describe("parsePage / parseSort / parseQuery", () => {
  it("clamps the page to a positive integer", () => {
    expect(parsePage("3")).toBe(3)
    expect(parsePage("-5")).toBe(1)
    expect(parsePage("0")).toBe(1)
    expect(parsePage("abc")).toBe(1)
    expect(parsePage("2.7")).toBe(2)
    expect(parsePage("1e12")).toBe(100_000)
    expect(parsePage(undefined)).toBe(1)
  })

  it("falls back to lemma order for unknown sorts", () => {
    expect(parseSort("gloss")).toBe("gloss")
    expect(parseSort("password")).toBe("lemma")
  })

  it("trims and bounds the query", () => {
    expect(parseQuery("  hi ")).toBe("hi")
    expect(parseQuery("x".repeat(500))).toHaveLength(200)
  })

  it("gives every order a stable id tiebreaker", () => {
    for (const sort of ["lemma", "createdAt", "partOfSpeech", "gloss"] as const) {
      expect(dictionaryOrderBy(sort).at(-1)).toEqual({ id: "asc" })
    }
  })
})
