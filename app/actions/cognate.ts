"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { getDevUserId } from "@/lib/dev-auth"
import { revalidatePath } from "next/cache"

/**
 * Link a dictionary entry to its source/ancestor entry (cognate tracking).
 */
export async function linkCognate(entryId: string, sourceEntryId: string) {
  const session = await auth()
  const userId = session?.user?.id || (process.env.DEV_MODE === "true" ? await getDevUserId() : null)
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
  let current: string | null = sourceEntryId
  let depth = 0
  while (current && depth < 20) {
    if (current === entryId) return { error: "Circular cognate chain detected" }
    const parent: { sourceEntryId: string | null } | null = await prisma.dictionaryEntry.findUnique({
      where: { id: current },
      select: { sourceEntryId: true },
    })
    current = parent?.sourceEntryId ?? null
    depth++
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
  const session = await auth()
  const userId = session?.user?.id || (process.env.DEV_MODE === "true" ? await getDevUserId() : null)
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
  const chain: { id: string; lemma: string; gloss: string; ipa: string | null; languageName: string; languageSlug: string }[] = []

  let currentId: string | null = entryId
  let depth = 0

  while (currentId && depth < 20) {
    const entry: {
      id: string; lemma: string; gloss: string; ipa: string | null;
      sourceEntryId: string | null;
      language: { name: string; slug: string };
    } | null = await prisma.dictionaryEntry.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        lemma: true,
        gloss: true,
        ipa: true,
        sourceEntryId: true,
        language: { select: { name: true, slug: true } },
      },
    })

    if (!entry) break

    chain.push({
      id: entry.id,
      lemma: entry.lemma,
      gloss: entry.gloss,
      ipa: entry.ipa,
      languageName: entry.language.name,
      languageSlug: entry.language.slug,
    })

    currentId = entry.sourceEntryId
    depth++
  }

  return chain
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
