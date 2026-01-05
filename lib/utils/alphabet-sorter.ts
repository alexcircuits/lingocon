// Minimal interface needed for sorting
interface SortableSymbol {
    symbol: string
    capitalSymbol?: string | null
    order: number
}

export function createAlphabetSorter(symbols: SortableSymbol[]) {
    // Create a map of character to order index
    const orderMap = new Map<string, number>()

    // Sort symbols by their defined order first
    const sortedSymbols = [...symbols].sort((a, b) => a.order - b.order)

    sortedSymbols.forEach((s, index) => {
        if (s.symbol) {
            orderMap.set(s.symbol, index)
            orderMap.set(s.symbol.normalize("NFC"), index)
            orderMap.set(s.symbol.normalize("NFD"), index)
        }
        if (s.capitalSymbol) {
            orderMap.set(s.capitalSymbol, index)
            orderMap.set(s.capitalSymbol.normalize("NFC"), index)
            orderMap.set(s.capitalSymbol.normalize("NFD"), index)
        }
    })

    return (a: string, b: string) => {
        if (!a && !b) return 0
        if (!a) return -1
        if (!b) return 1

        // Normalize both strings
        const normA = a.normalize("NFC")
        const normB = b.normalize("NFC")

        // We can't just iterate char by char because of complex clusters.
        // However, simplest approach for now assumes user put base chars in alphabet.
        // Ideally we use Intl.Segmenter but that might be slow for large lists in JS sort.
        // Let's stick to simple char iteration for now, or Intl.Collator if we could customize it (we can't easily).

        // Better approach: Iterate through the strings
        const lenA = normA.length
        const lenB = normB.length
        const minLen = Math.min(lenA, lenB)

        for (let i = 0; i < minLen; i++) {
            const charA = normA[i]
            const charB = normB[i]

            if (charA !== charB) {
                const orderA = orderMap.get(charA)
                const orderB = orderMap.get(charB)

                // If both are in our alphabet, compare by order
                if (orderA !== undefined && orderB !== undefined) {
                    return orderA - orderB
                }

                // If one is in alphabet and other isn't, alphabet comes first? 
                // Or standard sort? Let's say standard sort for undefined ones.
                if (orderA !== undefined) return -1
                if (orderB !== undefined) return 1

                // Both unknown, use standard locale compare
                return charA.localeCompare(charB)
            }
        }

        return lenA - lenB
    }
}
