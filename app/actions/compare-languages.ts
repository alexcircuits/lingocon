"use server"

import { prisma } from "@/lib/prisma"

/**
 * Compare two languages' dictionaries.
 * Returns shared glosses (potential cognates), unique words, and overlap percentage.
 */
export async function compareLanguages(langIdA: string, langIdB: string) {
  const [langA, langB] = await Promise.all([
    prisma.language.findUnique({
      where: { id: langIdA },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { dictionaryEntries: true } },
      },
    }),
    prisma.language.findUnique({
      where: { id: langIdB },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { dictionaryEntries: true } },
      },
    }),
  ])

  if (!langA || !langB) {
    return { error: "One or both languages not found" }
  }

  // Fetch dictionaries
  const [entriesA, entriesB] = await Promise.all([
    prisma.dictionaryEntry.findMany({
      where: { languageId: langIdA },
      select: { lemma: true, gloss: true, ipa: true, partOfSpeech: true },
      orderBy: { lemma: "asc" },
    }),
    prisma.dictionaryEntry.findMany({
      where: { languageId: langIdB },
      select: { lemma: true, gloss: true, ipa: true, partOfSpeech: true },
      orderBy: { lemma: "asc" },
    }),
  ])

  // Build gloss sets for overlap computation
  const glossesA = new Set(entriesA.map(e => e.gloss.toLowerCase().trim()))
  const glossesB = new Set(entriesB.map(e => e.gloss.toLowerCase().trim()))

  // Shared meanings (same gloss in both languages)
  const sharedGlosses: { gloss: string; lemmaA: string; lemmaB: string; ipaA?: string | null; ipaB?: string | null }[] = []
  const glossMapA = new Map<string, typeof entriesA[0]>()
  entriesA.forEach(e => glossMapA.set(e.gloss.toLowerCase().trim(), e))

  glossesB.forEach(g => {
    if (glossMapA.has(g)) {
      const a = glossMapA.get(g)!
      const b = entriesB.find(e => e.gloss.toLowerCase().trim() === g)!
      sharedGlosses.push({
        gloss: g,
        lemmaA: a.lemma,
        lemmaB: b.lemma,
        ipaA: a.ipa,
        ipaB: b.ipa,
      })
    }
  })

  // Unique to each language
  const uniqueToA = entriesA.filter(e => !glossesB.has(e.gloss.toLowerCase().trim())).length
  const uniqueToB = entriesB.filter(e => !glossesA.has(e.gloss.toLowerCase().trim())).length

  // Overlap percentage (Jaccard similarity)
  const union = new Set([...glossesA, ...glossesB])
  const overlapPercent = union.size > 0
    ? Math.round((sharedGlosses.length / union.size) * 100)
    : 0

  return {
    languageA: langA,
    languageB: langB,
    sharedGlosses: sharedGlosses.sort((a, b) => a.gloss.localeCompare(b.gloss)).slice(0, 100), // Cap at 100
    uniqueToA,
    uniqueToB,
    overlapPercent,
    totalA: entriesA.length,
    totalB: entriesB.length,
  }
}
