import type { ScriptSymbol, DictionaryEntry, GrammarPage, Paradigm } from "@prisma/client"

interface ValidationWarning {
  type: "undefined_symbol" | "missing_entry" | "unused_symbol" | "missing_paradigm"
  message: string
  severity: "warning" | "info"
}

/**
 * Check for undefined symbols in dictionary entries
 */
export function checkUndefinedSymbols(
  entries: DictionaryEntry[],
  symbols: ScriptSymbol[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Create a set of all defined symbols (both lowercase and uppercase)
  const symbolSet = new Set<string>()
  symbols.forEach((s) => {
    if (s.symbol) symbolSet.add(s.symbol)
    if (s.capitalSymbol) symbolSet.add(s.capitalSymbol)
  })

  entries.forEach((entry) => {
    // Split lemma into characters and filter out whitespace and common punctuation
    const entrySymbols = entry.lemma.split("").filter(char => !/\s/.test(char))

    // Also ignore common punctuation that shouldn't require explicit symbol definition
    const punctuationRegex = /[.,!?;:()"'`\-_/\\\[\]{}<>|@#$%^&*+=~]/
    const undefinedSymbols = entrySymbols.filter((char) =>
      !symbolSet.has(char) && !punctuationRegex.test(char)
    )

    if (undefinedSymbols.length > 0) {
      const uniqueUndefined = [...new Set(undefinedSymbols)]
      warnings.push({
        type: "undefined_symbol",
        message: `Entry "${entry.lemma}" uses undefined symbols: ${uniqueUndefined.join(", ")}`,
        severity: "warning",
      })
    }
  })

  return warnings
}

/**
 * Check for unused script symbols
 */
export function checkUnusedSymbols(
  symbols: ScriptSymbol[],
  entries: DictionaryEntry[],
  pages: GrammarPage[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []
  const usedSymbols = new Set<string>()

  // Collect symbols used in dictionary entries
  entries.forEach((entry) => {
    entry.lemma.split("").forEach((char) => usedSymbols.add(char))
  })

  // Collect symbols used in grammar pages (basic check)
  pages.forEach((page) => {
    const content = JSON.stringify(page.content)
    symbols.forEach((symbol) => {
      if (content.includes(symbol.symbol)) {
        usedSymbols.add(symbol.symbol)
      }
    })
  })

  symbols.forEach((symbol) => {
    if (!usedSymbols.has(symbol.symbol)) {
      warnings.push({
        type: "unused_symbol",
        message: `Symbol "${symbol.symbol}" is defined but not used`,
        severity: "info",
      })
    }
  })

  return warnings
}

/**
 * Check for dictionary entries referencing missing paradigms
 */
export function checkMissingParadigms(
  entries: DictionaryEntry[],
  paradigms: Paradigm[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []
  const paradigmIds = new Set(paradigms.map((p) => p.id))

  entries.forEach((entry) => {
    if (entry.paradigmId && !paradigmIds.has(entry.paradigmId)) {
      warnings.push({
        type: "missing_paradigm",
        message: `Entry "${entry.lemma}" references a missing paradigm`,
        severity: "warning",
      })
    }
  })

  return warnings
}

/**
 * Get all validation warnings for a language
 */
export function getValidationWarnings(
  symbols: ScriptSymbol[],
  entries: DictionaryEntry[],
  pages: GrammarPage[],
  paradigms: Paradigm[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  warnings.push(...checkUndefinedSymbols(entries, symbols))
  // Unused symbols check removed - too noisy for standard alphabets
  // warnings.push(...checkUnusedSymbols(symbols, entries, pages))
  warnings.push(...checkMissingParadigms(entries, paradigms))

  return warnings
}

