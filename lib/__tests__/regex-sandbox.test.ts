// @vitest-environment node
import { describe, it, expect } from "vitest"


import { replaceInWorker, RegexTimeoutError } from "../regex-sandbox"
import { computeFindReplaceWith } from "../bulk-lexicon"

describe("replaceInWorker", () => {
  it("performs the replacement off-thread", async () => {
    await expect(replaceInWorker(["kara", "tuk"], "a", "g", "o")).resolves.toEqual(["koro", "tuk"])
  })

  it("kills catastrophic backtracking at the deadline instead of blocking", async () => {
    const pattern = "\\w*".repeat(11) + "!" // ~18 s on 28 chars when run inline
    const started = Date.now()
    await expect(replaceInWorker(["a".repeat(40)], pattern, "g", "x", 300)).rejects.toBeInstanceOf(
      RegexTimeoutError
    )
    expect(Date.now() - started).toBeLessThan(3_000)
  })

  it("surfaces the timeout as a find/replace error", async () => {
    const res = await computeFindReplaceWith(
      (values, pattern, flags, replacement) => replaceInWorker(values, pattern, flags, replacement, 300),
      [{ id: "1", lemma: "a".repeat(40), gloss: "", ipa: null }],
      "lemma",
      "\\w*".repeat(11) + "!",
      "x"
    )
    expect(res.changes).toEqual([])
    expect(res.error).toMatch(/too long/)
  })
})
