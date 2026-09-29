/**
 * Keeps `DictionaryEntry.relatedWords` consistent.
 *
 * The column is a JSON array of *lemma strings* — that is what the entry dialog, the derivation
 * wizard, CSV/JSON import, exports and both dictionary views have always written and read. These
 * helpers maintain those references when entries are deleted, renamed or linked, and never pull
 * the whole lexicon into Node: rows are found with a jsonb `?|` match inside the language.
 */
import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

export function asLemmaList(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

/** Of `lemmas`, those no entry in the language still carries (a homonym keeps a lemma alive). */
async function orphanedLemmas(tx: Tx, languageId: string, lemmas: string[]): Promise<string[]> {
  const unique = [...new Set(lemmas)]
  if (unique.length === 0) return []
  const alive = await tx.dictionaryEntry.findMany({
    where: { languageId, lemma: { in: unique } },
    select: { lemma: true },
  })
  const aliveSet = new Set(alive.map((e) => e.lemma))
  return unique.filter((lemma) => !aliveSet.has(lemma))
}

async function entriesReferencing(tx: Tx, languageId: string, lemmas: string[]) {
  if (lemmas.length === 0) return []
  return tx.$queryRaw<{ id: string; relatedWords: Prisma.JsonValue }[]>`
    SELECT id, "relatedWords" FROM dictionary_entries
    WHERE "languageId" = ${languageId}
      AND jsonb_typeof("relatedWords") = 'array'
      AND "relatedWords" ?| ${lemmas}::text[]`
}

/** After entries are deleted: drop references to lemmas that no longer exist in the language. */
export async function removeRelatedReferences(tx: Tx, languageId: string, deletedLemmas: string[]) {
  const orphaned = await orphanedLemmas(tx, languageId, deletedLemmas)
  const rows = await entriesReferencing(tx, languageId, orphaned)
  const drop = new Set(orphaned)
  for (const row of rows) {
    await tx.dictionaryEntry.update({
      where: { id: row.id },
      data: { relatedWords: asLemmaList(row.relatedWords).filter((l) => !drop.has(l)) },
    })
  }
  return rows.length
}

/** After a lemma rename: point references at the new spelling, unless a homonym keeps the old one. */
export async function renameRelatedReferences(
  tx: Tx,
  languageId: string,
  oldLemma: string,
  newLemma: string
) {
  if (oldLemma === newLemma) return 0
  const orphaned = await orphanedLemmas(tx, languageId, [oldLemma])
  if (orphaned.length === 0) return 0
  const rows = await entriesReferencing(tx, languageId, [oldLemma])
  for (const row of rows) {
    const renamed = asLemmaList(row.relatedWords).map((l) => (l === oldLemma ? newLemma : l))
    await tx.dictionaryEntry.update({
      where: { id: row.id },
      data: { relatedWords: [...new Set(renamed)] },
    })
  }
  return rows.length
}

/**
 * Reciprocal linking (GitHub #65): when entry `lemma` gains related words, each linked entry gets
 * `lemma` back; when a link is removed, the back-link is removed too.
 */
export async function syncReciprocalLinks(
  tx: Tx,
  params: { languageId: string; entryId: string; lemma: string; before: string[]; after: string[] }
) {
  const { languageId, entryId, lemma, before, after } = params
  const added = after.filter((l) => l !== lemma && !before.includes(l))
  const removed = before.filter((l) => l !== lemma && !after.includes(l))
  if (added.length === 0 && removed.length === 0) return 0

  const targets = await tx.dictionaryEntry.findMany({
    where: { languageId, id: { not: entryId }, lemma: { in: [...added, ...removed] } },
    select: { id: true, lemma: true, relatedWords: true },
  })

  let changed = 0
  for (const target of targets) {
    const current = asLemmaList(target.relatedWords)
    const next = added.includes(target.lemma)
      ? current.includes(lemma) ? current : [...current, lemma]
      : current.filter((l) => l !== lemma)
    if (next.length === current.length && next.every((l, i) => l === current[i])) continue
    await tx.dictionaryEntry.update({ where: { id: target.id }, data: { relatedWords: next } })
    changed++
  }
  return changed
}
