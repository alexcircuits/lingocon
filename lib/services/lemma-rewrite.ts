/**
 * Persist a bulk lemma (and optionally IPA) rewrite — sound-change application, module
 * transformers — without leaving the rest of the lexicon pointing at old spellings.
 *
 * - All entry updates plus the related-word remap commit in one transaction (all-or-nothing, as
 *   the sound-change UI promises).
 * - `relatedWords` stores lemma strings, so every reference to a rewritten lemma is remapped. The
 *   rewrite is a pure function of the lemma, so old → new is well defined even with homonyms.
 * - Paradigms of entries whose lemma changed get an `inflection_regen` job, like bulk find/replace.
 */
import { prisma } from "@/lib/prisma"
import { enqueueJob } from "@/lib/jobs/queue"
import { asLemmaList } from "@/lib/services/related-words"

export interface LemmaRewrite {
  id: string
  lemma: string
  /** Omit to leave IPA untouched. */
  ipa?: string | null
}

export async function applyLemmaRewrites(languageId: string, rewrites: LemmaRewrite[]) {
  if (rewrites.length === 0) return { updated: 0, relatedUpdated: 0 }

  const before = await prisma.dictionaryEntry.findMany({
    where: { id: { in: rewrites.map((r) => r.id) }, languageId },
    select: { id: true, lemma: true, paradigmId: true },
  })
  const beforeById = new Map(before.map((e) => [e.id, e]))
  const scoped = rewrites.filter((r) => beforeById.has(r.id))

  const renames = new Map<string, string>()
  for (const r of scoped) {
    const old = beforeById.get(r.id)!.lemma
    if (old !== r.lemma) renames.set(old, r.lemma)
  }

  const relatedUpdated = await prisma.$transaction(
    async (tx) => {
      for (const r of scoped) {
        await tx.dictionaryEntry.update({
          where: { id: r.id },
          data: r.ipa === undefined ? { lemma: r.lemma } : { lemma: r.lemma, ipa: r.ipa },
        })
      }
      if (renames.size === 0) return 0

      const withRelated = await tx.$queryRaw<{ id: string; relatedWords: unknown }[]>`
        SELECT id, "relatedWords" FROM dictionary_entries
        WHERE "languageId" = ${languageId}
          AND jsonb_typeof("relatedWords") = 'array'
          AND "relatedWords" ?| ${[...renames.keys()]}::text[]`
      for (const row of withRelated) {
        const remapped = [...new Set(asLemmaList(row.relatedWords as never).map((l) => renames.get(l) ?? l))]
        await tx.dictionaryEntry.update({ where: { id: row.id }, data: { relatedWords: remapped } })
      }
      return withRelated.length
    },
    // Large lexicons: allow well beyond Prisma's 5 s interactive default.
    { timeout: 120_000, maxWait: 10_000 }
  )

  const paradigmIds = new Set(
    scoped
      .filter((r) => beforeById.get(r.id)!.lemma !== r.lemma)
      .map((r) => beforeById.get(r.id)!.paradigmId)
      .filter((id): id is string => !!id)
  )
  for (const paradigmId of paradigmIds) {
    await enqueueJob("inflection_regen", { paradigmId })
  }

  return { updated: scoped.length, relatedUpdated }
}
