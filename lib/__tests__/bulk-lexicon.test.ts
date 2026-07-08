import { describe, it, expect } from "vitest"
import { computeFindReplace, type LexEntry } from "@/lib/bulk-lexicon"

const entries: LexEntry[] = [
  { id: "1", lemma: "kato", gloss: "cat", ipa: "ˈka.to" },
  { id: "2", lemma: "kanu", gloss: "dog", ipa: "ˈka.nu" },
  { id: "3", lemma: "mero", gloss: "sea", ipa: "ˈme.ro" },
]

describe("computeFindReplace", () => {
  it("returns only changed entries", () => {
    const res = computeFindReplace(entries, "lemma", "ka", "ga")
    expect(res.error).toBeUndefined()
    expect(res.changes).toEqual([
      { id: "1", before: "kato", after: "gato" },
      { id: "2", before: "kanu", after: "ganu" },
    ])
  })

  it("supports regex + backreferences", () => {
    // Swap the two syllables around the dot: "ˈka.to" → "toˈka" style.
    const res = computeFindReplace(entries, "gloss", "^(.)(.*)$", "$2$1")
    expect(res.changes.find((c) => c.id === "1")?.after).toBe("atc")
  })

  it("is case-insensitive when requested", () => {
    const res = computeFindReplace(
      [{ id: "1", lemma: "KaTo", gloss: "x", ipa: null }],
      "lemma",
      "ka",
      "ga",
      { caseInsensitive: true },
    )
    expect(res.changes[0].after).toBe("gaTo")
  })

  it("operates on ipa, treating null as empty", () => {
    const res = computeFindReplace(
      [{ id: "1", lemma: "x", gloss: "y", ipa: null }],
      "ipa",
      "a",
      "b",
    )
    expect(res.changes).toEqual([]) // nothing to change in an empty ipa
  })

  it("errors on an empty pattern", () => {
    expect(computeFindReplace(entries, "lemma", "", "x").error).toBeDefined()
  })

  it("errors on an invalid regex instead of throwing", () => {
    const res = computeFindReplace(entries, "lemma", "(", "x")
    expect(res.error).toBe("Invalid regular expression")
    expect(res.changes).toEqual([])
  })

  it("refuses catastrophic-backtracking AND overlapping-alternation patterns", () => {
    // Nested quantifier (caught by the base heuristic)…
    expect(computeFindReplace(entries, "lemma", "(a+)+$", "x").error).toContain("complex")
    // …and overlapping alternation, which the base heuristic MISSES but the
    // stricter server guard (any quantified group) rejects.
    expect(computeFindReplace(entries, "lemma", "(a|a)+$", "x").error).toContain("complex")
    expect(computeFindReplace(entries, "lemma", "(a|aa)*", "x").error).toContain("complex")
  })

  it("rejects any quantified group server-side (over-blocks safe (ab)+ by design)", () => {
    expect(computeFindReplace(entries, "lemma", "(ka)+", "x").error).toContain("complex")
  })

  it("still allows ordinary patterns and optional groups", () => {
    expect(computeFindReplace(entries, "lemma", "^ka", "ga").error).toBeUndefined()
    expect(computeFindReplace(entries, "lemma", "(ka)?to", "X").error).toBeUndefined() // ? is bounded, safe
  })
})
