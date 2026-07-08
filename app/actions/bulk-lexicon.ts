"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { computeFindReplace, LEX_FIELDS, type LexField } from "@/lib/bulk-lexicon"
import { enqueueJob } from "@/lib/jobs/queue"
import { rateLimit } from "@/lib/rate-limit"

export interface BulkFindReplaceInput {
  languageId: string
  field: LexField
  pattern: string
  replacement: string
  caseInsensitive?: boolean
  /** Optional selection; when omitted the whole language's lexicon is scanned. */
  entryIds?: string[]
}

async function loadEntries(languageId: string, entryIds?: string[]) {
  return prisma.dictionaryEntry.findMany({
    where: {
      languageId,
      ...(entryIds && entryIds.length ? { id: { in: entryIds } } : {}),
    },
    select: { id: true, lemma: true, gloss: true, ipa: true },
  })
}

/** Dry run: compute the changes a regex find/replace WOULD make, without writing. */
export async function previewBulkFindReplace(input: BulkFindReplaceInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }
  if (!rateLimit(`bulk-fr-preview:${userId}`, 30, 60_000).ok) {
    return { error: "Too many requests — please wait a moment." }
  }
  if (!LEX_FIELDS.includes(input.field)) return { error: "Invalid field" }
  if (!(await canEditScope(input.languageId, userId, "write:dictionary"))) {
    return { error: "Unauthorized" }
  }

  const entries = await loadEntries(input.languageId, input.entryIds)
  const res = computeFindReplace(entries, input.field, input.pattern, input.replacement, {
    caseInsensitive: input.caseInsensitive,
  })
  if (res.error) return { error: res.error }
  // Cap the previewed rows; report the true total separately.
  return { success: true as const, data: { changes: res.changes.slice(0, 200), total: res.changes.length } }
}

/** Apply the regex find/replace, persisting every changed entry. */
export async function applyBulkFindReplace(input: BulkFindReplaceInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }
  if (!rateLimit(`bulk-fr-apply:${userId}`, 10, 60_000).ok) {
    return { error: "Too many requests — please wait a moment." }
  }
  if (!LEX_FIELDS.includes(input.field)) return { error: "Invalid field" }

  const lang = await prisma.language.findUnique({
    where: { id: input.languageId },
    select: { slug: true },
  })
  if (!lang) return { error: "Language not found" }
  if (!(await canEditScope(input.languageId, userId, "write:dictionary"))) {
    return { error: "Unauthorized" }
  }

  const entries = await loadEntries(input.languageId, input.entryIds)
  const res = computeFindReplace(entries, input.field, input.pattern, input.replacement, {
    caseInsensitive: input.caseInsensitive,
  })
  if (res.error) return { error: res.error }
  if (res.changes.length === 0) return { success: true as const, data: { updatedCount: 0 } }

  // Chunk the writes so a large lexicon can't blow past Prisma's transaction
  // timeout or hold locks/one connection for the whole run (each row has a
  // distinct new value, so this can't be a single updateMany).
  const BATCH_SIZE = 200
  for (let i = 0; i < res.changes.length; i += BATCH_SIZE) {
    const batch = res.changes.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      // field is validated against LEX_FIELDS, so the dynamic key is safe.
      batch.map((c) => prisma.dictionaryEntry.update({ where: { id: c.id }, data: { [input.field]: c.after } })),
    )
  }

  // A lemma change invalidates any materialized inflected forms — regenerate the
  // affected paradigms in the background.
  if (input.field === "lemma") {
    const affected = await prisma.dictionaryEntry.findMany({
      where: { id: { in: res.changes.map((c) => c.id) }, paradigmId: { not: null } },
      select: { paradigmId: true },
      distinct: ["paradigmId"],
    })
    for (const a of affected) {
      if (a.paradigmId) await enqueueJob("inflection_regen", { paradigmId: a.paradigmId })
    }
  }

  revalidatePath(`/studio/lang/${lang.slug}/dictionary`)
  return { success: true as const, data: { updatedCount: res.changes.length } }
}
