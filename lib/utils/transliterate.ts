import type { ScriptSymbol } from "@prisma/client"

/**
 * Transliterates text from native script to Latin using script symbol mappings
 */
export function transliterateToLatin(
  text: string,
  symbols: ScriptSymbol[]
): string {
  if (!text || symbols.length === 0) {
    return text
  }

  // Create a map of native symbols to Latin equivalents
  const symbolMap = new Map<string, string>()
  symbols.forEach((symbol) => {
    if (symbol.latin && symbol.symbol) {
      symbolMap.set(symbol.symbol, symbol.latin)
    }
  })

  // Transliterate character by character
  return text
    .split("")
    .map((char) => symbolMap.get(char) || char)
    .join("")
}

/**
 * Transliterates text from Latin to native script using script symbol mappings
 */
export function transliterateToNative(
  text: string,
  symbols: ScriptSymbol[]
): string {
  if (!text || symbols.length === 0) {
    return text
  }

  // Create a reverse map of Latin to native symbols
  const latinMap = new Map<string, string>()
  symbols.forEach((symbol) => {
    if (symbol.latin && symbol.symbol) {
      // If multiple symbols map to same Latin, prefer the first one
      if (!latinMap.has(symbol.latin)) {
        latinMap.set(symbol.latin, symbol.symbol)
      }
    }
  })

  // Transliterate character by character
  return text
    .split("")
    .map((char) => latinMap.get(char) || char)
    .join("")
}

