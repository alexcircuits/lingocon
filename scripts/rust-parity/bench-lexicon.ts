/**
 * TypeScript side of the lexicon-analysis benchmark (Rust side:
 * rust/crates/core/examples/bench_lexicon.rs). Builds a seeded 100k-entry synthetic lexicon,
 * times main's getValidationWarnings + matchSwadeshList on it exactly as the studio overview
 * calls them, and writes the dataset plus the TypeScript results for the Rust benchmark to
 * re-check and time on identical input.
 *
 *   npx tsx scripts/rust-parity/bench-lexicon.ts [entries=100000] [samples=5]
 *   cargo run --release --manifest-path rust/Cargo.toml -p lingocon-core --example bench_lexicon
 *
 * Run from the repository root; output goes to rust/target/lexicon-bench/ (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { getValidationWarnings } from "@/lib/utils/validation"
import { matchSwadeshList } from "@/lib/data/swadesh-list"
import { ALPHABETS, mulberry32, randomEntries, type LemmaProfile } from "./corpus"
import type { FixtureEntry, FixtureSymbol } from "./lexicon-types"

const OUT_DIR = "rust/target/lexicon-bench"
const MAX_WARNINGS_SHOWN = 50 // as in app/studio/lang/[slug]/page.tsx

/** A plausible conlang: mostly valid lemmas, a few stray accented letters and punctuation. */
const REALISTIC_PROFILE: LemmaProfile = {
  noiseRate: 0.03,
  noise: ["\u00e9", "\u00e1", "\u00f6", "\u0161", "e\u0301", "'", "-", " ", "2", "q", "w", "y"],
  minTokens: 2,
  maxTokens: 9,
  emptyRate: 0.005,
  longRate: 0.001,
  repeatRate: 0.02,
  longTokens: [40, 160],
}

interface Scenario {
  name: string
  allowsDiacritics: boolean
}

const SCENARIOS: Scenario[] = [
  { name: "diacritics-off", allowsDiacritics: false },
  { name: "diacritics-on", allowsDiacritics: true },
]

function analyze(symbols: FixtureSymbol[], entries: FixtureEntry[], paradigmIds: string[], scenario: Scenario) {
  const allWarnings = getValidationWarnings(symbols, entries, paradigmIds.map((id) => ({ id })), {
    allowsDiacritics: scenario.allowsDiacritics,
  })
  const warnings = allWarnings.slice(0, MAX_WARNINGS_SHOWN)
  const { matched } = matchSwadeshList(entries.map((entry) => entry.gloss))
  return { warnings, total: allWarnings.length, matchedIds: Array.from(matched).sort((a, b) => a - b) }
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

function main(): void {
  const entryCount = Number(process.argv[2] ?? 100_000)
  const samples = Number(process.argv[3] ?? 5)
  const rng = mulberry32(0x00be_0824)
  const symbols = ALPHABETS.latinDigraphs
  const present = Array.from({ length: 10 }, (_, i) => `paradigm-${i}`)
  const paradigmIds = present
  const entries = randomEntries(rng, entryCount, symbols, REALISTIC_PROFILE, {
    present,
    missing: ["deleted-1", "deleted-2"],
    nullRate: 0.7,
    emptyRate: 0.05,
    presentRate: 0.23,
  })

  const results = SCENARIOS.map((scenario) => {
    analyze(symbols, entries, paradigmIds, scenario) // warm-up (JIT)
    const timings: number[] = []
    let expected = analyze(symbols, entries, paradigmIds, scenario)
    for (let i = 0; i < samples; i++) {
      const start = performance.now()
      expected = analyze(symbols, entries, paradigmIds, scenario)
      timings.push(performance.now() - start)
    }
    return { ...scenario, expected, timingsMs: timings }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const datasetPath = path.join(OUT_DIR, "dataset.json")
  writeFileSync(
    datasetPath,
    JSON.stringify({ symbols, entries, paradigmIds, maxWarnings: MAX_WARNINGS_SHOWN, scenarios: results })
  )
  const summary = {
    engine: `node ${process.version} (ICU ${process.versions.icu}, Unicode ${process.versions.unicode})`,
    entries: entries.length,
    samples,
    dataset: datasetPath,
    scenarios: results.map(({ name, expected, timingsMs }) => ({
      name,
      totalWarnings: expected.total,
      matchedSwadesh: expected.matchedIds.length,
      medianMs: Number(median(timingsMs).toFixed(1)),
      minMs: Number(Math.min(...timingsMs).toFixed(1)),
    })),
  }
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n")
}

main()
