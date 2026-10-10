import { parseSyllableStructure } from "./word-generator"

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

/** One phoneme as a sticky, case-insensitive matcher (same flags as the old alternation). */
function phonemeMatchers(phonemes: string[]): RegExp[] {
    return Array.from(new Set(phonemes)).map(
        (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iy')
    )
}

/**
 * Does `str` split into one or more syllables of `syllableStructure` (e.g. "(C)V(C)"),
 * with C/V slots filled by the given phonemes, ignoring case, whitespace, digits,
 * punctuation and symbols?
 *
 * This used to compile `^((C)?V(C)?)+$` into one regex. Correct, but a word that
 * almost fits made it backtrack exponentially (≈10 s at 31 letters, ≈100 s at 37
 * for "(C)(C)V(C)(C)"), synchronously on the server during every dictionary save.
 * Now it is a reachability search over (position, slot) states: each phoneme is
 * still matched by its own case-insensitive regex — exactly how the alternation
 * matched one alternative — so results are unchanged, in O(length × slots ×
 * phonemes) time.
 */
export function validatePhonotactics(
    str: string,
    syllableStructure?: string | null,
    consonants?: string[] | null,
    vowels?: string[] | null
): boolean {
    if (!str || !syllableStructure || !consonants?.length || !vowels?.length) return true // Cannot validate

    const slots = parseSyllableStructure(syllableStructure)
    if (slots.length === 0) return true

    // Strip whitespace and punctuation before checking
    const word = str.replace(/[\s\d\p{P}\p{S}]+/gu, '')
    if (!word) return true // only punctuation

    const matchers = { C: phonemeMatchers(consonants), V: phonemeMatchers(vowels) }
    // End positions of every phoneme of a class starting at a position, computed once.
    const endsCache = { C: new Map<number, number[]>(), V: new Map<number, number[]>() }
    const endsAt = (type: "C" | "V", position: number): number[] => {
        const cached = endsCache[type].get(position)
        if (cached) return cached
        const ends: number[] = []
        for (const matcher of matchers[type]) {
            matcher.lastIndex = position
            const match = matcher.exec(word)
            if (match) ends.push(position + match[0].length)
        }
        endsCache[type].set(position, ends)
        return ends
    }

    // State = (position in word, next slot); slot === slots.length means a
    // syllable just ended there. Accept when a syllable ends at the very end.
    const slotCount = slots.length
    const visited = new Uint8Array((word.length + 1) * (slotCount + 1))
    const stack: number[] = [0, 0]
    const push = (position: number, slot: number) => {
        const key = position * (slotCount + 1) + slot
        if (visited[key]) return
        visited[key] = 1
        stack.push(position, slot)
    }
    visited[0] = 1

    while (stack.length > 0) {
        const slot = stack.pop()!
        const position = stack.pop()!
        if (slot === slotCount) {
            if (position === word.length) return true
            push(position, 0) // the next syllable starts here
            continue
        }
        const { type, optional } = slots[slot]
        if (optional) push(position, slot + 1)
        if (type !== "C" && type !== "V") {
            push(position, slot + 1)
            continue
        }
        for (const end of endsAt(type, position)) push(end, slot + 1)
    }
    return false
}

