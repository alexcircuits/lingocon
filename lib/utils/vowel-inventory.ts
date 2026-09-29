import {
  IPA_VOWEL_MAP,
  VOWEL_BACKNESS,
  VOWEL_HEIGHTS,
} from "@/lib/data/ipa-data"
import { languageMetadataSchema } from "@/lib/validations/language"

export type VowelChartPoint = {
  ipa: string
  height: (typeof VOWEL_HEIGHTS)[number]
  backness: (typeof VOWEL_BACKNESS)[number]
  rounded: boolean
  /** Normalized 0 (front) → 1 (back), before trapezoid mapping */
  x: number
  /** Normalized 0 (close) → 1 (open) */
  y: number
}

const HEIGHT_TO_Y: Record<string, number> = {
  Close: 0,
  "Near-close": 0.16,
  "Close-mid": 0.33,
  Mid: 0.5,
  "Open-mid": 0.66,
  "Near-open": 0.82,
  Open: 1,
}

const BACKNESS_TO_X: Record<string, number> = {
  Front: 0,
  Central: 0.5,
  Back: 1,
}

const SORTED_VOWEL_KEYS = Object.keys(IPA_VOWEL_MAP).sort((a, b) => b.length - a.length)

/** Greedy-parse IPA strings from script symbol fields into known vowel phonemes. */
export function extractVowelsFromSymbolIpa(ipaValues: Array<string | null | undefined>): string[] {
  const found = new Set<string>()

  for (const raw of ipaValues) {
    if (!raw) continue
    const cleaned = raw.replace(/[\/\[\]]/g, "").trim()
    if (!cleaned) continue

    if (IPA_VOWEL_MAP[cleaned]) {
      found.add(cleaned)
      continue
    }

    let remaining = cleaned
    while (remaining.length > 0) {
      let matched = false
      for (const key of SORTED_VOWEL_KEYS) {
        if (remaining.startsWith(key)) {
          found.add(key)
          remaining = remaining.slice(key.length)
          matched = true
          break
        }
      }
      if (!matched) remaining = remaining.slice(1)
    }
  }

  return Array.from(found)
}

/** Resolve the language vowel inventory (manual override wins over auto-detect). */
export function extractVowelInventory(
  symbols: Array<{ ipa: string | null }>,
  metadata: unknown
): string[] {
  // Malformed metadata (e.g. `vowels` saved as a string) falls back to the symbols, not an exception.
  const result = languageMetadataSchema.safeParse(metadata ?? {})
  const parsed = result.success ? result.data : {}
  const override = parsed.phonologyOverride

  if (override?.enabled && override.vowels && override.vowels.length > 0) {
    return [...new Set(override.vowels)]
  }

  const fromSymbols = extractVowelsFromSymbolIpa(symbols.map((s) => s.ipa))
  if (fromSymbols.length > 0) return fromSymbols

  if (parsed.vowels && parsed.vowels.length > 0) {
    return [...new Set(parsed.vowels)]
  }

  return []
}

export function vowelToChartPoint(ipa: string): VowelChartPoint | null {
  const info = IPA_VOWEL_MAP[ipa]
  if (!info) return null

  const y = HEIGHT_TO_Y[info.height] ?? 0.5
  let x = BACKNESS_TO_X[info.backness] ?? 0.5
  // Nudge rounded/unrounded pairs apart on the quadrilateral
  x += info.rounded ? 0.045 : -0.045
  x = Math.max(0, Math.min(1, x))

  return {
    ipa,
    height: info.height as VowelChartPoint["height"],
    backness: info.backness as VowelChartPoint["backness"],
    rounded: info.rounded,
    x,
    y,
  }
}

export function buildVowelChartData(vowelIpaList: string[]): {
  points: VowelChartPoint[]
  unknown: string[]
} {
  const points: VowelChartPoint[] = []
  const unknown: string[] = []

  for (const ipa of [...new Set(vowelIpaList)]) {
    const point = vowelToChartPoint(ipa)
    if (point) points.push(point)
    else unknown.push(ipa)
  }

  points.sort((a, b) => a.y - b.y || a.x - b.x || a.ipa.localeCompare(b.ipa))
  return { points, unknown }
}
