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

    // Normalize the input string to NFD (canonical decomposition) to separate base chars from diacritics
    // This allows us to check them individually if needed, OR we can check the composed form.
    // Strategy:
    // 1. Check if the grapheme cluster (composed char) is in the allowed set.
    // 2. If not, check if it's composed of valid parts (base + allowed combining marks).

    // Actually, let's keep it simple first.
    // If the user defines "e" and "´" separately, then "é" should be valid.
    // But "é" might be entered as U+00E9 (composed) or U+0065 U+0301 (decomposed).

    const invalidChars: string[] = []

    // Use Intl.Segmenter to iterate over grapheme clusters (user-perceived characters)
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
    const segments = segmenter.segment(str)

    for (const segment of segments) {
        const char = segment.segment

        // Check if the exact composed char is allowed
        // Normalize both to NFC to ensure consistent comparison
        if (allowedChars.has(char) || allowedChars.has(char.normalize("NFC")) || allowedChars.has(char.normalize("NFD"))) {
            continue
        }

        // If composed char itself isn't explicitly allowed, check its parts
        // Normalize to NFD to split base and diacritics
        const decomposed = char.normalize("NFD")
        let isValidSequence = true

        for (const codePoint of decomposed) {
            if (!allowedChars.has(codePoint)) {
                isValidSequence = false
                break
            }
        }

        if (!isValidSequence) {
            invalidChars.push(char)
        }
    }

    // Remove duplicates
    return Array.from(new Set(invalidChars))
}
