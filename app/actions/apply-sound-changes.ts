"use server"

import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { parseProgram, applyPipeline } from "@/lib/utils/sound-change"
import { createActivity } from "@/lib/utils/activity"
import { enqueueJob } from "@/lib/jobs/queue"
import { asLemmaList } from "@/lib/services/related-words"
import { toActionError } from "@/lib/errors"
import {
  inventorySets,
  sameSoundChangeInputs,
  soundChangeInputs,
  type SoundChangeInputs,
} from "@/app/studio/lang/[slug]/sound-changes/sound-change-inputs"

/** Why an application was refused without changing anything. */
export type SoundChangeConflict = "RULES_CHANGED"

export type ApplySoundChangesResult =
  | { success: true; data: { applied: number; unchanged: number }; error?: never; code?: never }
  | { success?: never; error: string; code?: SoundChangeConflict }

const RULES_CHANGED_MESSAGE =
  "The saved sound change rules or phonology changed since you reviewed this preview. " +
  "Nothing was applied. Review the latest rules and try again."

const reviewedPhonemes = z.array(z.string().max(256)).max(10_000).nullable()
const reviewedInputsSchema = z.strictObject({
  rules: z.string().max(1_000_000),
  vowels: reviewedPhonemes,
  consonants: reviewedPhonemes,
})

type Outcome =
  | { kind: "conflict"; slug: string }
  | { kind: "error"; message: string }
  | {
      kind: "applied"
      slug: string
      ruleCount: number
      total: number
      applied: number
      /** Paradigms of entries whose lemma changed: their inflected forms must regenerate. */
      paradigmIds: string[]
    }

interface EntryRow {
  id: string
  lemma: string
  ipa: string | null
  paradigmId: string | null
}

/**
 * Write the rewrites and remap `relatedWords` (which stores lemma strings) inside the caller's
 * transaction. Mirrors lib/services/lemma-rewrite#applyLemmaRewrites, which opens its own
 * transaction and so cannot share the one holding the reviewed-inputs check.
 */
async function writeRewrites(
  tx: Prisma.TransactionClient,
  languageId: string,
  updates: { entry: EntryRow; lemma: string; ipa: string | null }[]
) {
  const renames = new Map<string, string>()
  for (const { entry, lemma, ipa } of updates) {
    if (entry.lemma !== lemma) renames.set(entry.lemma, lemma)
    await tx.dictionaryEntry.update({ where: { id: entry.id }, data: { lemma, ipa } })
  }
  if (renames.size === 0) return

  const withRelated = await tx.$queryRaw<{ id: string; relatedWords: Prisma.JsonValue }[]>`
    SELECT id, "relatedWords" FROM dictionary_entries
    WHERE "languageId" = ${languageId}
      AND jsonb_typeof("relatedWords") = 'array'
      AND "relatedWords" ?| ${[...renames.keys()]}::text[]`
  for (const row of withRelated) {
    const remapped = [...new Set(asLemmaList(row.relatedWords).map((l) => renames.get(l) ?? l))]
    await tx.dictionaryEntry.update({ where: { id: row.id }, data: { relatedWords: remapped } })
  }
}

/**
 * One transaction: lock the language row, check the stored rules/phonology are exactly what the
 * user reviewed, read (and lock) the entries, compute and write. Metadata saves update the same row,
 * so they wait for this transaction instead of slipping in between the check and the writes.
 * `FOR NO KEY UPDATE` (not `FOR UPDATE`): it still serializes those writers, but does not block
 * the `FOR KEY SHARE` locks that inserts referencing these rows take (new entries, activities,
 * comments…) for the whole duration of an apply on a large lexicon.
 */
async function applyReviewed(languageId: string, reviewed: SoundChangeInputs): Promise<Outcome> {
  return prisma.$transaction(
    async (tx): Promise<Outcome> => {
      const [language] = await tx.$queryRaw<{ slug: string; metadata: Prisma.JsonValue }[]>`
        SELECT slug, metadata FROM "languages" WHERE id = ${languageId} FOR NO KEY UPDATE`
      if (!language) return { kind: "error", message: "Language not found" }

      const inputs = soundChangeInputs(language.metadata)
      if (!sameSoundChangeInputs(inputs, reviewed)) return { kind: "conflict", slug: language.slug }
      if (!inputs.rules.trim()) {
        return { kind: "error", message: "No saved sound change rules found. Save your rules first." }
      }
      const { classes, rules } = parseProgram(inputs.rules)
      if (rules.length === 0) {
        return { kind: "error", message: "No valid rules could be parsed from the saved rules." }
      }
      const { vowels, consonants } = inventorySets(inputs)

      // Locked so a concurrent edit of an entry cannot be overwritten with a stale rewrite.
      const entries = await tx.$queryRaw<EntryRow[]>`
        SELECT id, lemma, ipa, "paradigmId" FROM dictionary_entries
        WHERE "languageId" = ${languageId}
        ORDER BY id
        FOR NO KEY UPDATE`

      const updates: { entry: EntryRow; lemma: string; ipa: string | null }[] = []
      for (const entry of entries) {
        const lemma = applyPipeline(entry.lemma, rules, vowels, consonants, classes).changed
        const ipa = entry.ipa ? applyPipeline(entry.ipa, rules, vowels, consonants, classes).changed : entry.ipa
        if (lemma !== entry.lemma || ipa !== entry.ipa) updates.push({ entry, lemma, ipa })
      }
      await writeRewrites(tx, languageId, updates)

      const paradigmIds = new Set(
        updates
          .filter((u) => u.lemma !== u.entry.lemma && u.entry.paradigmId)
          .map((u) => u.entry.paradigmId as string)
      )
      return {
        kind: "applied",
        slug: language.slug,
        ruleCount: rules.length,
        total: entries.length,
        applied: updates.length,
        paradigmIds: [...paradigmIds],
      }
    },
    // Large lexicons: allow well beyond Prisma's 5 s interactive default.
    { timeout: 120_000, maxWait: 10_000 }
  )
}

/**
 * Apply the language's saved sound change rules to every dictionary entry, updating the lemma
 * (and IPA if present) in place.
 *
 * `reviewed` is exactly what the editor previewed: the saved rules text and the phonology classes.
 * Applying is irreversible, so it is refused with a typed conflict (and nothing changes) unless the
 * stored inputs still match exactly. Requires the dictionary scope.
 */
export async function applySoundChangesToDictionary(
  languageId: string,
  reviewed: SoundChangeInputs
): Promise<ApplySoundChangesResult> {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const expected = reviewedInputsSchema.safeParse(reviewed)
  if (!expected.success) {
    return { error: "Reload the page and review the sound changes before applying them." }
  }

  // This rewrites every lemma/IPA in the dictionary, so it needs the dictionary scope — checking
  // collaborator *role* let a drafts-only contributor (role EDITOR) rewrite the whole lexicon.
  if (!(await canEditScope(languageId, userId, "write:dictionary"))) return { error: "Unauthorized" }

  let outcome: Outcome
  try {
    outcome = await applyReviewed(languageId, expected.data)
  } catch (error) {
    return { ...toActionError(error, "Failed to apply sound changes") }
  }

  if (outcome.kind === "error") return { error: outcome.message }
  if (outcome.kind === "conflict") {
    // Re-render the editor with the current saved rules and phonology.
    revalidatePath(`/studio/lang/${outcome.slug}/sound-changes`)
    return { error: RULES_CHANGED_MESSAGE, code: "RULES_CHANGED" }
  }

  if (outcome.applied > 0) {
    for (const paradigmId of outcome.paradigmIds) {
      await enqueueJob("inflection_regen", { paradigmId })
    }
    await createActivity({
      type: "UPDATED",
      entityType: "DICTIONARY_ENTRY",
      entityId: languageId,
      languageId,
      userId,
      description: `Applied sound change rules to ${outcome.applied} dictionary entries (lemma + IPA)`,
      metadata: { ruleCount: outcome.ruleCount, updatedCount: outcome.applied },
    })
    revalidatePath(`/studio/lang/${outcome.slug}/dictionary`)
    revalidatePath(`/lang/${outcome.slug}/dictionary`)
    revalidatePath(`/studio/lang/${outcome.slug}/sound-changes`)
  }

  return {
    success: true,
    data: { applied: outcome.applied, unchanged: outcome.total - outcome.applied },
  }
}
