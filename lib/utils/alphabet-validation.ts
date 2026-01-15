// Minimal interface needed for validation
interface AlphabetSymbol {
    symbol: string
    capitalSymbol?: string | null
}

export function validateStringAgainstAlphabet(str: string, symbols: AlphabetSymbol[]): string[] {
    if (!str || !symbols || symbols.length === 0) return []

    // Create a set of allowed characters
    // We need to handle both precomposed and decomposed forms
    const allowedChars = new Set<string>()
    const combiningDiacritics = new Set<string>()

    symbols.forEach((s) => {
        // Add the main symbol
        if (s.symbol) {
            allowedChars.add(s.symbol)
            allowedChars.add(s.symbol.normalize("NFC"))
            allowedChars.add(s.symbol.normalize("NFD"))

            // Check if it's a combining diacritic (using regex for simplicity)
            if (/^\p{M}$/u.test(s.symbol)) {
                combiningDiacritics.add(s.symbol)
                combiningDiacritics.add(s.symbol.normalize("NFC"))
                combiningDiacritics.add(s.symbol.normalize("NFD"))
            }
        }
        // Add the capital symbol
        if (s.capitalSymbol) {
            allowedChars.add(s.capitalSymbol)
            allowedChars.add(s.capitalSymbol.normalize("NFC"))
            allowedChars.add(s.capitalSymbol.normalize("NFD"))
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
        // 1. Check if it starts with an ignored character (whitespace, digit, punctuation, symbol)
        // We check one char at a time for these
        // Intl.Segmenter is better for graphemes, but for regex checks on \s\d\p{P}\p{S}, one code point is usually providing the class.
        // Let's use Segmenter just to be safe about what "one character" is.

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

        // If no symbol matched, check if the next grapheme is a valid "ignored" character
        // We need to extract the next grapheme
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
        const iterator = segmenter.segment(remaining)[Symbol.iterator]()
        const nextSegment = iterator.next().value

        if (nextSegment) {
            const char = nextSegment.segment
            // Check if it's whitespace, digits, or punctuation
            if (/^[\s\d\p{P}\p{S}]+$/u.test(char)) {
                remaining = remaining.slice(char.length)
                matchFound = true
            } else {
                // If we get here, it's an invalid character
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
