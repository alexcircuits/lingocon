/** Shapes shared by the Rust parity fixture builders (mirrors rust/crates/core/tests/common). */
import type { ValidationWarning } from "@/lib/utils/validation"

/** `script_symbols.symbol` / `capitalSymbol` as the overview page selects them. */
export interface FixtureSymbol {
  symbol: string
  capitalSymbol: string | null
}

/** `dictionary_entries.lemma` / `gloss` / `paradigmId` as the overview page selects them. */
export interface FixtureEntry {
  lemma: string
  gloss: string
  paradigmId: string | null
}

export interface LexiconInput {
  symbols: FixtureSymbol[]
  entries: FixtureEntry[]
  paradigmIds: string[]
  allowsDiacritics: boolean
}

/** Exactly what main's TypeScript produces for a `LexiconInput`. */
export interface LexiconExpected {
  warnings: ValidationWarning[]
  total: number
  matchedIds: number[]
}

export interface LexiconCase extends LexiconInput {
  name: string
  expected: LexiconExpected
}
