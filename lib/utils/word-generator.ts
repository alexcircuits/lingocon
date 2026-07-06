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
    /**
     * Optional frequency weights for phonemes.
     * Keys are IPA strings; values are relative frequencies (higher = more common).
     * Derived from the existing lexicon so generated words feel natural.
     */
    phonemeWeights?: Map<string, number>
    /** Regex source strings; candidates matching any are rejected. */
    rejectPatterns?: string[]
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
 * Pick a phoneme from a list using weighted probability.
 * Falls back to uniform selection if no weights are provided or all weights are 0.
 */
function pickWeighted(phonemes: string[], weights: Map<string, number> | undefined): string {
    if (!weights || phonemes.length === 0) return pickRandom(phonemes)

    const wArr = phonemes.map(p => weights.get(p) ?? 1)
    const total = wArr.reduce((a, b) => a + b, 0)
    if (total === 0) return pickRandom(phonemes)

    let r = Math.random() * total
    for (let i = 0; i < phonemes.length; i++) {
        r -= wArr[i]
        if (r <= 0) return phonemes[i]
    }
    return phonemes[phonemes.length - 1]
}

/**
 * Build a phoneme frequency map from an existing word list.
 * Greedy-matches phonemes (longest first) in each word.
 */
export function buildPhonemeWeights(
    words: string[],
    allPhonemes: string[]
): Map<string, number> {
    const sorted = [...allPhonemes].sort((a, b) => b.length - a.length)
    const freq = new Map<string, number>()

    for (const word of words) {
        let i = 0
        while (i < word.length) {
            let matched = false
            for (const ph of sorted) {
                if (word.startsWith(ph, i)) {
                    freq.set(ph, (freq.get(ph) ?? 0) + 1)
                    i += ph.length
                    matched = true
                    break
                }
            }
            if (!matched) i++
        }
    }

    return freq
}

/**
 * Generate a single syllable from template slots.
 */
function generateSyllable(
    slots: TemplateSlot[],
    consonants: string[],
    vowels: string[],
    weights?: Map<string, number>
): string {
    let result = ""

    for (const slot of slots) {
        // Skip optional slots ~50% of the time
        if (slot.optional && Math.random() < 0.5) continue

        if (slot.type === "C" && consonants.length > 0) {
            result += pickWeighted(consonants, weights)
        } else if (slot.type === "V" && vowels.length > 0) {
            result += pickWeighted(vowels, weights)
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
        phonemeWeights,
        rejectPatterns,
    } = options

    if (consonants.length === 0 && vowels.length === 0) return []

    // Default to simple CV if no structure provided
    const template = syllableStructure.trim() || "CV"
    const slots = parseSyllableStructure(template)

    if (slots.length === 0) return []

    // Compile forbidden-sequence patterns, silently skipping invalid regex sources.
    const rejects: RegExp[] = []
    for (const pattern of rejectPatterns ?? []) {
        try {
            rejects.push(new RegExp(pattern))
        } catch {
            // Ignore invalid regex sources; generation proceeds without them.
        }
    }

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
            word += generateSyllable(slots, consonants, vowels, phonemeWeights)
        }

        // Skip empty, too-short, duplicate, or forbidden-pattern words
        if (
            word.length >= 2 &&
            !results.has(word) &&
            !existing.has(word) &&
            !rejects.some(re => re.test(word))
        ) {
            results.add(word)
        }
    }

    return Array.from(results)
}
