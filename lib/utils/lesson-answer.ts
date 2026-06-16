/**
 * Answer-checking for the lesson engine.
 *
 * Pure, framework-free logic extracted from `lesson-engine.tsx` so the (subtle)
 * matching rules — case/whitespace folding, diacritic-insensitive comparison,
 * typo tolerance, and opt-in romanized matching — are unit-testable and shared.
 */

export type ScriptSymbol = { symbol: string; latin: string | null }

/** Transliterate text using a script's symbol→latin map (unmapped chars pass through). */
export function romanize(text: string, symbols: ScriptSymbol[]): string {
  const map = new Map(symbols.filter(s => s.latin).map(s => [s.symbol, s.latin!]))
  return text.split("").map(c => map.get(c) ?? c).join("")
}

/** Classic edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

/** Drop combining marks (accents/diacritics) via NFD normalization. */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "")
}

/** Lowercase, trim, and strip diacritics for lenient comparison. */
export function normalizeForCompare(s: string): string {
  return stripDiacritics(s.trim().toLowerCase())
}

/**
 * Compare with typo tolerance: exact after normalization, or within an
 * edit-distance budget that scales with target length (0 for ≤4 chars, 1 for
 * ≤8, 2 beyond).
 */
export function matchWithTolerance(rawInput: string, target: string): boolean {
  const a = normalizeForCompare(rawInput)
  const b = normalizeForCompare(target)
  if (a === b) return true
  // Allow 1 typo for words longer than 4 chars, 2 for words longer than 8
  const tolerance = b.length <= 4 ? 0 : b.length <= 8 ? 1 : 2
  return levenshtein(a, b) <= tolerance
}

/**
 * Decide whether a learner's answer is acceptable for an expected target.
 *
 * Order: exact (case/space-insensitive) → diacritic-insensitive with typo
 * tolerance → (opt-in) the same against the romanized form of the target.
 */
export function isAnswerCorrect(
  userInput: string,
  expected: string,
  options?: { acceptRomanized?: boolean; scriptSymbols?: ScriptSymbol[] },
): boolean {
  const raw = userInput.trim().toLowerCase()
  const target = expected.trim().toLowerCase()
  if (raw === target) return true
  // Diacritic-insensitive compare: a missed combining mark shouldn't fail
  // the learner. Normalize both sides before measuring edit distance.
  if (matchWithTolerance(raw, target)) return true

  // Optional: accept the Latin transliteration of the expected answer as
  // correct. Opt-in per language because for many conlangs the romanization
  // is lossy or ambiguous.
  if (options?.acceptRomanized && options.scriptSymbols && options.scriptSymbols.length > 0) {
    const romanizedTarget = romanize(target, options.scriptSymbols).toLowerCase()
    if (romanizedTarget && romanizedTarget !== target && matchWithTolerance(raw, romanizedTarget)) {
      return true
    }
  }

  return false
}
