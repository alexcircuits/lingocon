// Auto-inflection engine. Turns a dictionary stem + a per-cell transform rule
// into an inflected form: (prefix + stem + suffix), then an optional
// sound-change program run over the result (reusing the sound-change engine),
// so both agglutinative affixing and fusional stem mutation / sandhi work.

import { parseProgram, applyPipeline } from "@/lib/utils/sound-change"

export interface InflectionRule {
  prefix?: string
  suffix?: string
  /** A sound-change program (may include `class` defs) applied after affixing. */
  soundChange?: string
}

export interface InflectionContext {
  /** The language's vowel inventory, so `V` in a snippet means the right set. */
  vowels?: Set<string>
  /** The language's consonant inventory, so `C` means the right set. */
  consonants?: Set<string>
}

/** Apply one cell's transform to a stem. */
export function applyInflection(
  stem: string,
  rule: InflectionRule,
  ctx: InflectionContext = {},
): string {
  // A leading dash on a suffix / trailing dash on a prefix is a morpheme
  // boundary marker in linguistic notation, not a character — drop it. Trim
  // surrounding whitespace too so a stray space isn't baked into every form
  // (which would break exact-match search on the materialized value).
  const prefix = (rule.prefix ?? "").trim().replace(/-$/, "")
  const suffix = (rule.suffix ?? "").trim().replace(/^-/, "")
  let form = `${prefix}${stem}${suffix}`

  const sc = rule.soundChange?.trim()
  if (sc) {
    const prog = parseProgram(sc)
    if (prog.rules.length > 0) {
      form = applyPipeline(form, prog.rules, ctx.vowels, ctx.consonants, prog.classes).changed
    }
  }
  return form
}

export interface CellRule extends InflectionRule {
  cellKey: string
}

export interface GeneratedForm {
  cellKey: string
  form: string
}

/** Generate every inflected form for a stem from a paradigm's cell rules. */
export function generateInflectedForms(
  stem: string,
  rules: CellRule[],
  ctx: InflectionContext = {},
): GeneratedForm[] {
  return rules.map((r) => ({ cellKey: r.cellKey, form: applyInflection(stem, r, ctx) }))
}
