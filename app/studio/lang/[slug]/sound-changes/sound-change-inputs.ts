/**
 * The inputs a sound-change run depends on, derived from language metadata ONE way for the page,
 * the editor preview and the irreversible server application. Pure: safe to import from server
 * components, server actions and the client.
 *
 * The phonology classes come from `metadata.phonologyOverride` (what the phonology editor writes).
 * The page used to read `metadata.phonology`, which nothing writes, so the preview used the default
 * classes while the application used the override.
 */

/** Phoneme classes for V/C in rules; null selects the engine's default class. */
export interface SoundChangeInventory {
  vowels: string[] | null
  consonants: string[] | null
}

/** What the user reviewed in the preview and expects the server to apply. */
export interface SoundChangeInputs extends SoundChangeInventory {
  rules: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function phonemeList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const phonemes = value.filter((item): item is string => typeof item === "string")
  return phonemes.length > 0 ? phonemes : null
}

/** The manual phonology override, when enabled, replaces the default classes. */
export function soundChangeInventory(metadata: unknown): SoundChangeInventory {
  const override = asRecord(asRecord(metadata)?.phonologyOverride)
  if (override?.enabled !== true) return { vowels: null, consonants: null }
  return { vowels: phonemeList(override.vowels), consonants: phonemeList(override.consonants) }
}

export function soundChangeInputs(metadata: unknown): SoundChangeInputs {
  const rules = asRecord(metadata)?.soundChangeRules
  return { rules: typeof rules === "string" ? rules : "", ...soundChangeInventory(metadata) }
}

/** Engine arguments for an inventory (undefined selects the default class). */
export function inventorySets(inventory: SoundChangeInventory): {
  vowels?: Set<string>
  consonants?: Set<string>
} {
  return {
    vowels: inventory.vowels ? new Set(inventory.vowels) : undefined,
    consonants: inventory.consonants ? new Set(inventory.consonants) : undefined,
  }
}

function sameList(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) return a === b
  return a.length === b.length && a.every((item, index) => item === b[index])
}

/** Exact comparison: applying is irreversible, so nothing is normalized. */
export function sameSoundChangeInputs(a: SoundChangeInputs, b: SoundChangeInputs): boolean {
  return a.rules === b.rules && sameList(a.vowels, b.vowels) && sameList(a.consonants, b.consonants)
}
