// Minimal interface needed for validation
interface AlphabetSymbol {
    symbol: string
    capitalSymbol?: string | null
}

interface ValidationOptions {
    allowsDiacritics?: boolean
}

/**
 * Extract the base character from a grapheme by removing combining diacritical marks.
 * e.g., "ě" -> "e", "á" -> "a", "ą" -> "a"
 */
function getBaseCharacter(grapheme: string): string {
    // Normalize to NFD to separate base char from combining marks
    const decomposed = grapheme.normalize("NFD")
    // Remove all combining diacritical marks (\p{M} matches all combining marks)
    return decomposed.replace(/\p{M}/gu, "")
}

export function validateStringAgainstAlphabet(
    str: string,
    symbols: AlphabetSymbol[],
    options: ValidationOptions = {}
): string[] {
    if (!str || !symbols || symbols.length === 0) return []

    const { allowsDiacritics = false } = options

    // Create a set of allowed characters
    // We need to handle both precomposed and decomposed forms
    const allowedChars = new Set<string>()
    const baseChars = new Set<string>() // For diacritics mode

    symbols.forEach((s) => {
        // Add the main symbol
        if (s.symbol) {
            allowedChars.add(s.symbol)
            allowedChars.add(s.symbol.normalize("NFC"))
            allowedChars.add(s.symbol.normalize("NFD"))

            // Also add the base character for diacritics mode
            if (allowsDiacritics) {
                const base = getBaseCharacter(s.symbol)
                if (base) baseChars.add(base.toLowerCase())
            }
        }
        // Add the capital symbol
        if (s.capitalSymbol) {
            allowedChars.add(s.capitalSymbol)
            allowedChars.add(s.capitalSymbol.normalize("NFC"))
            allowedChars.add(s.capitalSymbol.normalize("NFD"))

            // Also add the base character for diacritics mode
            if (allowsDiacritics) {
                const base = getBaseCharacter(s.capitalSymbol)
                if (base) baseChars.add(base.toLowerCase())
            }
        }
    })

    // Sort allowed symbols by length (descending) so we match the longest valid symbol first
    // This is crucial for digraphs (e.g. matching "ch" before "c" or "h")
    const sortedSymbols = Array.from(allowedChars).sort((a, b) => b.length - a.length)

    const invalidChars: string[] = []

    // Normalize input to NFC for consistent matching with our allowed set
    // We can also try NFD if NFC fails, or vice versa, but sticking to one is cleaner.
    // Since we added both NFC and NFD to allowedChars, we can just consume the string.
    let remaining = str.normalize("NFC")

    while (remaining.length > 0) {
        let matchFound = false

        // Try to match one of the allowed symbols at the beginning of the string
        for (const symbol of sortedSymbols) {
            if (remaining.startsWith(symbol)) {
                remaining = remaining.slice(symbol.length)
                matchFound = true
                break
            }
        }

        if (matchFound) continue

        // If no symbol matched, check if the next grapheme is valid
        // We need to extract the next grapheme
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
        const iterator = segmenter.segment(remaining)[Symbol.iterator]()
        const nextSegment = iterator.next().value

        if (nextSegment) {
            const char = nextSegment.segment

            // Check if it's whitespace, digits, or punctuation (always allowed)
            if (/^[\s\d\p{P}\p{S}]+$/u.test(char)) {
                remaining = remaining.slice(char.length)
                matchFound = true
            }
            // If diacritics mode is enabled, check if base char is in alphabet
            else if (allowsDiacritics) {
                const base = getBaseCharacter(char)
                if (base && baseChars.has(base.toLowerCase())) {
                    // Base character is in alphabet, so diacritical variant is allowed
                    remaining = remaining.slice(char.length)
                    matchFound = true
                } else {
                    // Base character not in alphabet
                    invalidChars.push(char)
                    remaining = remaining.slice(char.length)
                }
            } else {
                // Standard mode - mark as invalid
                invalidChars.push(char)
                remaining = remaining.slice(char.length)
            }
        } else {
            // Should not happen if length > 0, but just in case
            break;
        }
    }

    // Remove duplicates
    return Array.from(new Set(invalidChars))
}

