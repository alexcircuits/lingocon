"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"

/**
 * Link a dictionary entry to its source/ancestor entry (cognate tracking).
 */
export async function linkCognate(entryId: string, sourceEntryId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  // Verify both entries exist and user owns the entry being linked
  const [entry, sourceEntry] = await Promise.all([
    prisma.dictionaryEntry.findUnique({
      where: { id: entryId },
      select: { id: true, languageId: true, language: { select: { ownerId: true, slug: true } } },
    }),
    prisma.dictionaryEntry.findUnique({
      where: { id: sourceEntryId },
      select: { id: true, lemma: true },
    }),
  ])

  if (!entry) return { error: "Entry not found" }
  if (!sourceEntry) return { error: "Source entry not found" }
  if (entry.language.ownerId !== userId) return { error: "You can only link entries in your own languages" }
  if (entryId === sourceEntryId) return { error: "Cannot link an entry to itself" }

  // Prevent circular chains (walk up to 20 levels)
  const chain = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE chain AS (
      SELECT id, "sourceEntryId"
      FROM dictionary_entries WHERE id = ${sourceEntryId}
      UNION ALL
      SELECT e.id, e."sourceEntryId"
      FROM dictionary_entries e
      JOIN chain c ON e.id = c."sourceEntryId"
    )
    SELECT id FROM chain LIMIT 20
  `
  if (chain.some(c => c.id === entryId)) {
    return { error: "Circular cognate chain detected" }
  }

  await prisma.dictionaryEntry.update({
    where: { id: entryId },
    data: { sourceEntryId },
  })

  revalidatePath(`/studio/lang/${entry.language.slug}`)
  return { success: true }
}

/**
 * Remove a cognate link from an entry.
 */
export async function unlinkCognate(entryId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const entry = await prisma.dictionaryEntry.findUnique({
    where: { id: entryId },
    select: { language: { select: { ownerId: true, slug: true } } },
  })

  if (!entry) return { error: "Entry not found" }
  if (entry.language.ownerId !== userId) return { error: "Unauthorized" }

  await prisma.dictionaryEntry.update({
    where: { id: entryId },
    data: { sourceEntryId: null },
  })

  revalidatePath(`/studio/lang/${entry.language.slug}`)
  return { success: true }
}

/**
 * Get the cognate chain for an entry (walk up through source entries).
 */
export async function getCognateChain(entryId: string) {
  const chainRows = await prisma.$queryRaw<
    {
      id: string
      lemma: string
      gloss: string
      ipa: string | null
      sourceEntryId: string | null
      languageName: string
      languageSlug: string
    }[]
  >`
    WITH RECURSIVE chain AS (
      SELECT id, lemma, gloss, ipa, "sourceEntryId", "languageId"
      FROM dictionary_entries WHERE id = ${entryId}
      UNION ALL
      SELECT e.id, e.lemma, e.gloss, e.ipa, e."sourceEntryId", e."languageId"
      FROM dictionary_entries e
      JOIN chain c ON e.id = c."sourceEntryId"
    )
    SELECT c.id, c.lemma, c.gloss, c.ipa, c."sourceEntryId", l.name AS "languageName", l.slug AS "languageSlug"
    FROM chain c JOIN languages l ON c."languageId" = l.id
    LIMIT 20
  `

  return chainRows.map(row => ({
    id: row.id,
    lemma: row.lemma,
    gloss: row.gloss,
    ipa: row.ipa,
    languageName: row.languageName,
    languageSlug: row.languageSlug,
  }))
}

/**
 * Get entries from parent language to offer as cognate candidates.
 */
export async function getCognateCandidates(languageId: string, search?: string) {
  // Get the parent language
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { parentLanguageId: true },
  })

  if (!language?.parentLanguageId) return []

  const where: any = { languageId: language.parentLanguageId }
  if (search) {
    where.OR = [
      { lemma: { contains: search, mode: "insensitive" } },
      { gloss: { contains: search, mode: "insensitive" } },
    ]
  }

  return prisma.dictionaryEntry.findMany({
    where,
    select: {
      id: true,
      lemma: true,
      gloss: true,
      ipa: true,
    },
    orderBy: { lemma: "asc" },
    take: 50,
  })
}
