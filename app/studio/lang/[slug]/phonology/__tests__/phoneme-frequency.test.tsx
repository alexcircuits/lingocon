import { cleanup, render } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { PhonemeFrequencyChart } from "@/components/phoneme-frequency-chart"
import { summarizePhonemeFrequency } from "../phoneme-frequency"
import { PhonemeFrequencySummaryCard } from "../phoneme-frequency-summary"

afterEach(cleanup)

/** Group a full IPA column the way `GROUP BY ipa WHERE ipa <> ''` returns it (order is arbitrary). */
function grouped(ipaList: (string | null)[]) {
  const counts = new Map<string, number>()
  for (const ipa of ipaList) if (ipa !== null && ipa !== "") counts.set(ipa, (counts.get(ipa) ?? 0) + 1)
  return [...counts].reverse().map(([ipa, count]) => ({ ipa, count }))
}
function textOf(element: ReactElement) {
  const { container, unmount } = render(element)
  const text = container.textContent
  unmount()
  return text
}

// Distinct counts per phoneme so the client chart's (row-order) tie order is not involved.
const known = ["p", "t", "k", "a", "i", "u", "tʃ", "ʃ", "s", "m", "n", "ŋ"]
// Covers stress/brackets/dots, the tʃ digraph, a diacritic, empty/null/blank and unknown symbols.
const ipaList: (string | null)[] = [
  ...Array(9).fill("/ˈpa.pa/"), ...Array(5).fill("[tʃi]"), "kuku", "", null, "  ", "mana", "ʃiŋ", "su.su.su",
  "xyz", "nan", "tata", "paʰ", "titi", "tutu", "/ʃ/", "/ŋŋ/", "/kk/", "/nn/", "/sss/", "/tʃtʃ/", "/tt/", "/uu/", "/ii/",
]

describe("server-side phoneme frequency summary", () => {
  it("renders exactly what the client chart rendered from the full IPA list", () => {
    const original = textOf(<PhonemeFrequencyChart ipaList={ipaList} knownPhonemes={known} />)
    const summary = summarizePhonemeFrequency(grouped(ipaList), known)
    expect(original).toBeTruthy()
    expect(textOf(<PhonemeFrequencySummaryCard summary={summary} />)).toBe(original)
  })

  it("keeps only the 30 most frequent phonemes but the full totals", () => {
    const many = Array.from({ length: 40 }, (_, i) => String.fromCodePoint(0x100 + i))
    const list = many.flatMap((symbol, i) => Array(i + 1).fill(symbol))
    const summary = summarizePhonemeFrequency(grouped(list), many)
    expect(summary.top).toHaveLength(30)
    expect(summary.top[0]).toEqual({ phoneme: many[39], count: 40 })
    expect(summary.entryCount).toBe(list.length)
    expect(summary.totalTokens).toBe(list.length)
    expect(textOf(<PhonemeFrequencySummaryCard summary={summary} />))
      .toBe(textOf(<PhonemeFrequencyChart ipaList={list} knownPhonemes={many} />))
  })

  it("renders nothing when no known phoneme occurs, like the chart", () => {
    const summary = summarizePhonemeFrequency(grouped(["xyz"]), [])
    expect(textOf(<PhonemeFrequencySummaryCard summary={summary} />)).toBe("")
    expect(textOf(<PhonemeFrequencyChart ipaList={["xyz"]} knownPhonemes={[]} />)).toBe("")
  })
})
