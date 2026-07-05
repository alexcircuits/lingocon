/**
 * Apply a language's saved sound-change rules to word forms during derivation.
 *
 * Centralizes the "read `soundChangeRules` (+ optional `phonologyOverride`) from
 * a language's `metadata` JSON, then run the pipeline over a form" logic that
 * was previously inlined in `app/actions/apply-sound-changes.ts`. Reused by the
 * evolution/derivation flows so cloning a language can actually *evolve* its
 * forms instead of copying them verbatim.
 *
 * Pure and side-effect free — safe to unit test and to call inside a Prisma
 * transaction.
 */
import { parseProgram, applyPipeline, type SoundChangeRule } from "@/lib/utils/sound-change"

export interface SoundChangeConfig {
  rules: SoundChangeRule[]
  /** Optional explicit vowel inventory for the `V` class. */
  vowels?: Set<string>
  /** Optional explicit consonant inventory for the `C` class. */
  consonants?: Set<string>
  /** Optional user-defined named sound classes (`class K = p t k`). */
  classes?: Map<string, Set<string>>
}

/**
 * Build a {@link SoundChangeConfig} from a language's `metadata` JSON, or return
 * `null` when there are no usable rules — letting callers cheaply skip
 * transformation and fall back to verbatim copying (preserving today's behavior
 * for languages that have not defined any rules).
 */
export function extractSoundChangeConfig(metadata: unknown): SoundChangeConfig | null {
  const meta = (metadata ?? {}) as Record<string, unknown>

  const rulesText = typeof meta.soundChangeRules === "string" ? meta.soundChangeRules : ""
  if (!rulesText.trim()) return null

  const { classes, rules } = parseProgram(rulesText)
  if (rules.length === 0) return null

  const override = meta.phonologyOverride as
    | { enabled?: boolean; consonants?: string[]; vowels?: string[] }
    | undefined

  const vowels =
    override?.enabled && override.vowels?.length ? new Set(override.vowels) : undefined
  const consonants =
    override?.enabled && override.consonants?.length ? new Set(override.consonants) : undefined

  return { rules, vowels, consonants, classes }
}

/** Apply a sound-change config to a single non-empty form (lemma or IPA). */
export function deriveForm(form: string, config: SoundChangeConfig): string {
  return applyPipeline(form, config.rules, config.vowels, config.consonants, config.classes).changed
}

/** Apply to a nullable form (e.g. optional IPA); empty/null/undefined → `null`. */
export function deriveOptionalForm(
  form: string | null | undefined,
  config: SoundChangeConfig,
): string | null {
  if (!form) return null
  return deriveForm(form, config)
}
