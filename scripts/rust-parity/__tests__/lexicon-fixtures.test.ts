// @vitest-environment node
/**
 * Freshness check for the Rust lexicon-analysis parity fixtures (rust/crates/core/tests/fixtures
 * and rust/crates/core/src/swadesh_data.rs). They hold the outputs of main's TypeScript; if
 * lib/utils/validation.ts, lib/utils/alphabet-validation.ts or lib/data/swadesh-list.ts change
 * without regenerating them, the Rust port would be tested against a stale specification.
 *
 * Fix a failure with: npx tsx scripts/rust-parity/generate-lexicon-fixtures.ts
 * (then run `cargo test --manifest-path rust/Cargo.toml -p lingocon-core` and port the change).
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { analyzeWithTypeScript, buildFixtureFiles, FIXTURE_DIR, type FixtureFile } from "../lexicon-fixtures"

const ROOT = process.cwd()
const REGENERATE = "npx tsx scripts/rust-parity/generate-lexicon-fixtures.ts"

function staleness(file: FixtureFile, regenerate = REGENERATE): string | null {
  const target = path.join(ROOT, file.path)
  if (!existsSync(target)) return `${file.path} is missing - run ${regenerate}`
  const committed = readFileSync(target, "utf8")
  if (committed === file.content) return null
  const want = file.content.split("\n")
  const have = committed.split("\n")
  const line = want.findIndex((text, i) => text !== have[i])
  return (
    `${file.path} is stale - run ${regenerate}\n` +
    `first difference at line ${line + 1}:\n  committed: ${have[line]?.slice(0, 200)}\n  expected:  ${want[line]?.slice(0, 200)}`
  )
}

describe("Rust lexicon parity fixtures", () => {
  const files = buildFixtureFiles({ includeUnicodeTables: false })

  it.each(files.map((file) => [file.path, file] as const))("%s matches main's TypeScript", (_path, file) => {
    expect(staleness(file)).toBeNull()
  })

  it("records the TypeScript output of the overview's own call sequence", () => {
    const expected = analyzeWithTypeScript({
      symbols: [{ symbol: "a", capitalSymbol: "A" }],
      entries: [
        { lemma: "ax", gloss: "to eat", paradigmId: "gone" },
        { lemma: "A", gloss: "you", paradigmId: null },
      ],
      paradigmIds: [],
      allowsDiacritics: false,
    })
    expect(expected.warnings.map((warning) => warning.message)).toEqual([
      'Entry "ax" uses undefined symbols: x',
      'Entry "ax" references a missing paradigm',
    ])
    expect(expected.total).toBe(2)
    expect(expected.matchedIds).toEqual([2, 5, 93])
  })

  // The exhaustive Unicode snapshot describes the engine, not the repository, so it can only be
  // compared on a Node that carries the Unicode version it was generated with.
  const tablesPath = path.join(ROOT, FIXTURE_DIR, "unicode-tables.json")
  const tablesVersion = existsSync(tablesPath)
    ? (JSON.parse(readFileSync(tablesPath, "utf8")) as { unicodeVersion?: string }).unicodeVersion
    : undefined
  it.skipIf(tablesVersion !== process.versions.unicode)(
    "unicode-tables.json matches this engine",
    () => {
      const [tables] = buildFixtureFiles({ includeUnicodeTables: true }).filter((file) =>
        file.path.endsWith("unicode-tables.json")
      )
      expect(staleness(tables, `${REGENERATE} --unicode-tables`)).toBeNull()
    },
    60_000
  )
})
