// Persistence for auto-inflection: materialize each entry's inflected forms
// from its paradigm's rules. Auth-free (trusted) so both the server actions
// (which check permissions first) and the inflection_regen job can call it.

import { prisma } from "@/lib/prisma"
import {
  generateInflectedForms,
  type CellRule,
  type InflectionContext,
} from "@/lib/inflection"

interface RuleRow {
  cellKey: string
  prefix: string
  suffix: string
  soundChange: string
}

function toCellRules(rules: RuleRow[]): CellRule[] {
  return rules.map((r) => ({
    cellKey: r.cellKey,
    prefix: r.prefix,
    suffix: r.suffix,
    soundChange: r.soundChange,
  }))
}

/** Derive the sound-change V/C inventory from a language's metadata override. */
export function inflectionContextFromMetadata(metadata: unknown): InflectionContext {
  const m = (metadata as Record<string, unknown>) ?? {}
  const o = m.phonologyOverride as
    | { enabled?: boolean; vowels?: string[]; consonants?: string[] }
    | undefined
  return {
    vowels: o?.enabled && o.vowels?.length ? new Set(o.vowels) : undefined,
    consonants: o?.enabled && o.consonants?.length ? new Set(o.consonants) : undefined,
  }
}

/** Replace one entry's stored inflected forms (regen = delete-all-then-create). */
async function replaceEntryForms(
  entryId: string,
  stem: string,
  rules: CellRule[],
  ctx: InflectionContext,
): Promise<number> {
  const forms = generateInflectedForms(stem, rules, ctx)
  await prisma.$transaction(async (tx) => {
    await tx.inflectedForm.deleteMany({ where: { entryId } })
    if (forms.length > 0) {
      await tx.inflectedForm.createMany({
        data: forms.map((f) => ({ entryId, cellKey: f.cellKey, form: f.form })),
      })
    }
  })
  return forms.length
}

/** Regenerate a single entry's forms from its currently-linked paradigm. */
export async function regenerateEntryForms(entryId: string): Promise<number> {
  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: entryId },
    select: { lemma: true, paradigmId: true, language: { select: { metadata: true } } },
  })
  if (!entry) return 0
  if (!entry.paradigmId) {
    await prisma.inflectedForm.deleteMany({ where: { entryId } })
    return 0
  }
  const rules = await prisma.paradigmRule.findMany({ where: { paradigmId: entry.paradigmId } })
  const ctx = inflectionContextFromMetadata(entry.language.metadata)
  return replaceEntryForms(entryId, entry.lemma, toCellRules(rules), ctx)
}

/** Regenerate every entry attached to a paradigm (the inflection_regen job). */
export async function regenerateParadigmForms(paradigmId: string): Promise<number> {
  const paradigm = await prisma.paradigm.findUnique({
    where: { id: paradigmId },
    select: { language: { select: { metadata: true } } },
  })
  if (!paradigm) return 0
  const rules = toCellRules(await prisma.paradigmRule.findMany({ where: { paradigmId } }))
  const ctx = inflectionContextFromMetadata(paradigm.language.metadata)
  const entries = await prisma.dictionaryEntry.findMany({
    where: { paradigmId },
    select: { id: true, lemma: true },
  })
  let total = 0
  for (const entry of entries) {
    total += await replaceEntryForms(entry.id, entry.lemma, rules, ctx)
  }
  return total
}

/** Compute forms for an arbitrary stem WITHOUT persisting (live editor / public
 *  "conjugate this word" preview). */
export async function previewParadigmForms(paradigmId: string, stem: string) {
  const paradigm = await prisma.paradigm.findUnique({
    where: { id: paradigmId },
    select: { language: { select: { metadata: true } } },
  })
  const rules = await prisma.paradigmRule.findMany({
    where: { paradigmId },
    orderBy: { cellKey: "asc" },
  })
  const ctx = inflectionContextFromMetadata(paradigm?.language.metadata)
  return generateInflectedForms(stem, toCellRules(rules), ctx)
}
