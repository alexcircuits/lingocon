/**
 * Regenerates the Rust lexicon-analysis parity fixtures from main's TypeScript.
 *
 *   npx tsx scripts/rust-parity/generate-lexicon-fixtures.ts
 *   npx tsx scripts/rust-parity/generate-lexicon-fixtures.ts --unicode-tables
 *   npx tsx scripts/rust-parity/generate-lexicon-fixtures.ts --unicode-tables --out-root=/tmp/x
 *
 * Run from the repository root. Writes rust/crates/core/tests/fixtures/lexicon-cases.json,
 * lexicon-corpus.json, swadesh.json and rust/crates/core/src/swadesh_data.rs. Re-run whenever
 * lib/utils/validation.ts, lib/utils/alphabet-validation.ts or lib/data/swadesh-list.ts change
 * (`npm test` fails until you do: scripts/rust-parity/__tests__/lexicon-fixtures.test.ts), then
 * run `cargo test --manifest-path rust/Cargo.toml -p lingocon-core` and port the change to Rust.
 * These files are identical whichever Node (Unicode 15.1 to 17) generates them.
 *
 * `--unicode-tables` also rewrites unicode-tables.json, an exhaustive snapshot of the running
 * Node's V8/ICU Unicode data. Only do that with a Node whose `process.versions.unicode` equals
 * the Rust crates' Unicode version (js_text::UNICODE_VERSION). `--out-root` writes elsewhere,
 * e.g. to compare another Node version against Rust with
 * `LINGOCON_UNICODE_TABLES=<file> cargo test -p lingocon-core --test unicode_tables -- --nocapture`.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { buildFixtureFiles } from "./lexicon-fixtures"

function main(): void {
  const root = process.cwd()
  if (!existsSync(path.join(root, "rust/crates/core/Cargo.toml"))) {
    throw new Error(`Run from the repository root (no rust/crates/core under ${root})`)
  }
  const includeUnicodeTables = process.argv.includes("--unicode-tables")
  const outRootArg = process.argv.find((arg) => arg.startsWith("--out-root="))
  const outRoot = outRootArg ? path.resolve(outRootArg.slice("--out-root=".length)) : root
  for (const file of buildFixtureFiles({ includeUnicodeTables })) {
    const target = path.join(outRoot, file.path)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, file.content)
    const note = file.engineUnicodeVersion ? ` (Unicode ${file.engineUnicodeVersion})` : ""
    process.stdout.write(`wrote ${file.path} (${file.content.length} bytes)${note}\n`)
  }
}

main()
