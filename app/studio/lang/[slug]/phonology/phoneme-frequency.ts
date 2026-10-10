/**
 * Phoneme frequency over a language's dictionary transcriptions, computed on the server so only
 * the rendered top phonemes reach the browser. Pure and dependency-free. Tokenization and counting
 * match components/phoneme-frequency-chart (which the public phonology page still uses).
 */

export interface PhonemeFrequencySummary {
  /** Dictionary entries with a non-empty IPA transcription. */
  entryCount: number
  /** Counted tokens over all of those entries (not only the top phonemes). */
  totalTokens: number
  /** At most TOP_PHONEMES phonemes, most frequent first. */
  top: { phoneme: string; count: number }[]
}

/** One distinct transcription and how many entries share it (`GROUP BY ipa`). */
export interface IpaGroup {
  ipa: string | null
  count: number
}

const TOP_PHONEMES = 30

/** Characters to strip when parsing IPA strings */
const IPA_STRIP_RE = /[/\[\]ˈˌ.{}|‖↗↘\s]/g

/** Diacritics that modify a preceding phoneme (not standalone phonemes) */
const IPA_DIACRITICS_RE = /^[ʰʷʲˤˠˁːˑ̈̃̈͡]$/

/** Greedy two-code-unit digraphs first, exactly as the client chart tokenizes. */
function tokeniseIPA(ipa: string, phonemeSet?: Set<string>): string[] {
  const cleaned = ipa.replace(IPA_STRIP_RE, "")
  const tokens: string[] = []
  let i = 0
  while (i < cleaned.length) {
    if (i + 1 < cleaned.length) {
      const two = cleaned.slice(i, i + 2)
      if (phonemeSet ? phonemeSet.has(two) : false) {
        tokens.push(two)
        i += 2
        continue
      }
    }
    const ch = cleaned[i]
    if (!IPA_DIACRITICS_RE.test(ch)) {
      tokens.push(ch)
    }
    i++
  }
  return tokens.filter((token) => token.trim().length > 0)
}

/**
 * Summarize grouped transcriptions. Each distinct IPA string is tokenized once and weighted by how
 * many entries share it. Equal counts are ordered by code unit for a stable result (the client
 * chart ordered them by unordered database row order).
 */
export function summarizePhonemeFrequency(
  groups: Iterable<IpaGroup>,
  knownPhonemes?: string[]
): PhonemeFrequencySummary {
  const phonemeSet = knownPhonemes ? new Set(knownPhonemes) : undefined
  const counts = new Map<string, number>()
  let entryCount = 0
  let totalTokens = 0

  for (const { ipa, count } of groups) {
    if (!ipa || count <= 0) continue
    entryCount += count
    for (const token of tokeniseIPA(ipa, phonemeSet)) {
      // With a known set, only count known phonemes
      if (phonemeSet && !phonemeSet.has(token)) continue
      counts.set(token, (counts.get(token) ?? 0) + count)
      totalTokens += count
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, TOP_PHONEMES)
    .map(([phoneme, count]) => ({ phoneme, count }))

  return { entryCount, totalTokens, top }
}
