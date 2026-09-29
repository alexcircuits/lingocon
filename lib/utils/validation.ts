import { validateStringAgainstAlphabet } from "@/lib/utils/alphabet-validation"

export interface ValidationWarning {
  type: "undefined_symbol" | "missing_entry" | "unused_symbol" | "missing_paradigm"
  message: string
  severity: "warning" | "info"
}

type SymbolLike = { symbol: string; capitalSymbol?: string | null }
type EntryLike = { lemma: string; paradigmId?: string | null }
type ParadigmLike = { id: string }

/**
 * Entries whose lemma uses characters outside the language's alphabet. Uses the same matcher as the
 * entry dialog (longest symbol first, so digraphs like "sh" count, optional diacritic tolerance).
 * A language with no alphabet yet produces no warnings — otherwise every single entry was flagged.
 */
export function checkUndefinedSymbols(
  entries: EntryLike[],
  symbols: SymbolLike[],
  options: { allowsDiacritics?: boolean } = {}
): ValidationWarning[] {
  if (symbols.length === 0) return []
  const warnings: ValidationWarning[] = []
  for (const entry of entries) {
    const undefinedSymbols = validateStringAgainstAlphabet(entry.lemma, symbols, options)
    if (undefinedSymbols.length > 0) {
      warnings.push({
        type: "undefined_symbol",
        message: `Entry "${entry.lemma}" uses undefined symbols: ${undefinedSymbols.join(", ")}`,
        severity: "warning",
      })
    }
  }
  return warnings
}

/** Entries referencing a paradigm that no longer exists in the language. */
export function checkMissingParadigms(entries: EntryLike[], paradigms: ParadigmLike[]): ValidationWarning[] {
  const paradigmIds = new Set(paradigms.map((p) => p.id))
  return entries
    .filter((entry) => entry.paradigmId && !paradigmIds.has(entry.paradigmId))
    .map((entry) => ({
      type: "missing_paradigm" as const,
      message: `Entry "${entry.lemma}" references a missing paradigm`,
      severity: "warning" as const,
    }))
}

/** All validation warnings for a language. (An unused-symbol check existed but was too noisy.) */
export function getValidationWarnings(
  symbols: SymbolLike[],
  entries: EntryLike[],
  paradigms: ParadigmLike[],
  options: { allowsDiacritics?: boolean } = {}
): ValidationWarning[] {
  return [...checkUndefinedSymbols(entries, symbols, options), ...checkMissingParadigms(entries, paradigms)]
}
