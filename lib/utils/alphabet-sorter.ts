// Minimal interface needed for sorting
interface SortableSymbol {
    symbol: string
    capitalSymbol?: string | null
    order: number
}

/**
 * Helper to normalize comparison results to -1, 0, or 1
 * This prevents issues with libraries that can't handle large numbers
 */
function normalizeCompare(diff: number): number {
    if (!Number.isFinite(diff) || Number.isNaN(diff)) return 0
    if (diff < 0) return -1
    if (diff > 0) return 1
    return 0
}

export function createAlphabetSorter(symbols: SortableSymbol[]) {
    // Create a map of character to order index
    const orderMap = new Map<string, number>()

    // Sort symbols by their defined order first, with safety checks
    const sortedSymbols = [...symbols].sort((a, b) => {
        const orderA = Number.isFinite(a.order) ? a.order : 0
        const orderB = Number.isFinite(b.order) ? b.order : 0
        return normalizeCompare(orderA - orderB)
    })

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

    return (a: string, b: string): number => {
        if (!a && !b) return 0
        if (!a) return -1
        if (!b) return 1

        // Normalize both strings
        const normA = a.normalize("NFC")
        const normB = b.normalize("NFC")

        // Compare character by character
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
                    return normalizeCompare(orderA - orderB)
                }

                // If one is in alphabet and other isn't, alphabet comes first
                if (orderA !== undefined) return -1
                if (orderB !== undefined) return 1

                // Both unknown, use standard locale compare (already returns -1, 0, 1)
                return charA.localeCompare(charB)
            }
        }

        // Compare by length - normalize to prevent large numbers
        return normalizeCompare(lenA - lenB)
    }
}
