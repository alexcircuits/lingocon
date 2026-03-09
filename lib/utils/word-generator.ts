/**
 * Phonotactic Word Generator
 *
 * Takes a syllable structure template (e.g., "(C)CV(C)")
 * and lists of consonants/vowels to generate valid words.
 *
 * Template syntax:
 *   C  = required consonant
 *   V  = required vowel
 *   (C) = optional consonant (50% chance)
 *   (V) = optional vowel (50% chance)
 */

export interface WordGeneratorOptions {
    /** Syllable structure template, e.g. "(C)CV(C)" */
    syllableStructure: string
    /** Available consonant phonemes */
    consonants: string[]
    /** Available vowel phonemes */
    vowels: string[]
    /** Number of syllables per word (min) */
    minSyllables: number
    /** Number of syllables per word (max) */
    maxSyllables: number
    /** Number of words to generate */
    count: number
    /** Existing words to avoid duplicating */
    existingWords?: Set<string>
}

interface TemplateSlot {
    type: "C" | "V"
    optional: boolean
}

/**
 * Parse a syllable structure string into template slots.
 * E.g. "(C)CV(C)" → [{ type: C, optional: true }, { type: C, optional: false }, { type: V, optional: false }, { type: C, optional: true }]
 */
export function parseSyllableStructure(template: string): TemplateSlot[] {
    const slots: TemplateSlot[] = []
    let i = 0
    const t = template.replace(/\s/g, "")

    while (i < t.length) {
        if (t[i] === "(") {
            // Optional group
            const close = t.indexOf(")", i)
            if (close === -1) break
            const inner = t.substring(i + 1, close).toUpperCase()
            for (const ch of inner) {
                if (ch === "C" || ch === "V") {
                    slots.push({ type: ch, optional: true })
                }
            }
            i = close + 1
        } else {
            const ch = t[i].toUpperCase()
            if (ch === "C" || ch === "V") {
                slots.push({ type: ch, optional: false })
            }
            i++
        }
    }

    return slots
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generate a single syllable from template slots.
 */
function generateSyllable(slots: TemplateSlot[], consonants: string[], vowels: string[]): string {
    let result = ""

    for (const slot of slots) {
        // Skip optional slots ~50% of the time
        if (slot.optional && Math.random() < 0.5) continue

        if (slot.type === "C" && consonants.length > 0) {
            result += pickRandom(consonants)
        } else if (slot.type === "V" && vowels.length > 0) {
            result += pickRandom(vowels)
        }
    }

    return result
}

/**
 * Generate a batch of phonotactically valid words.
 */
export function generateWords(options: WordGeneratorOptions): string[] {
    const {
        syllableStructure,
        consonants,
        vowels,
        minSyllables,
        maxSyllables,
        count,
        existingWords,
    } = options

    if (consonants.length === 0 && vowels.length === 0) return []

    // Default to simple CV if no structure provided
    const template = syllableStructure.trim() || "CV"
    const slots = parseSyllableStructure(template)

    if (slots.length === 0) return []

    const results = new Set<string>()
    const existing = existingWords || new Set<string>()
    let attempts = 0
    const maxAttempts = count * 20 // Safety valve to avoid infinite loops

    while (results.size < count && attempts < maxAttempts) {
        attempts++

        // Random syllable count between min and max
        const syllableCount = minSyllables + Math.floor(Math.random() * (maxSyllables - minSyllables + 1))

        let word = ""
        for (let s = 0; s < syllableCount; s++) {
            word += generateSyllable(slots, consonants, vowels)
        }

        // Skip empty, too-short, or duplicate words
        if (word.length >= 2 && !results.has(word) && !existing.has(word)) {
            results.add(word)
        }
    }

    return Array.from(results)
}
