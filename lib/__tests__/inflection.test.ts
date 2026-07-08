import { describe, it, expect } from "vitest"
import { applyInflection, generateInflectedForms } from "@/lib/inflection"

describe("applyInflection", () => {
  it("returns the stem unchanged for an empty rule", () => {
    expect(applyInflection("kat", {})).toBe("kat")
  })

  it("appends a suffix", () => {
    expect(applyInflection("kat", { suffix: "en" })).toBe("katen")
  })

  it("prepends a prefix", () => {
    expect(applyInflection("lieb", { prefix: "ge" })).toBe("gelieb")
  })

  it("strips morpheme-boundary dashes (prefix trailing -, suffix leading -)", () => {
    expect(applyInflection("lieb", { prefix: "ge-", suffix: "-t" })).toBe("geliebt")
  })

  it("applies a sound-change program AFTER affixing", () => {
    // affix → "kate", then a → e everywhere → "kete"
    expect(applyInflection("kat", { suffix: "e", soundChange: "a → e" })).toBe("kete")
  })

  it("supports a contextual sound change (umlaut before a cluster)", () => {
    // "mann" + "er" = "manner"; a → e / _nn → "menner"
    expect(applyInflection("mann", { suffix: "er", soundChange: "a → e / _nn" })).toBe("menner")
  })

  it("ignores a blank / comment-only sound-change program", () => {
    expect(applyInflection("kat", { suffix: "en", soundChange: "   " })).toBe("katen")
  })
})

describe("generateInflectedForms", () => {
  it("produces one form per cell rule, keyed by cellKey", () => {
    const forms = generateInflectedForms("kat", [
      { cellKey: "0-0", suffix: "" },
      { cellKey: "0-1", suffix: "en" },
      { cellKey: "1-0", prefix: "ge-", suffix: "-t" },
    ])
    expect(forms).toEqual([
      { cellKey: "0-0", form: "kat" },
      { cellKey: "0-1", form: "katen" },
      { cellKey: "1-0", form: "gekatt" },
    ])
  })

  it("returns an empty array when there are no rules", () => {
    expect(generateInflectedForms("kat", [])).toEqual([])
  })
})
