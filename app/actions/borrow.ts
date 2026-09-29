"use server"

import { prisma } from "@/lib/prisma"

/**
 * Search languages available for borrowing: public languages OR the user's
 * own private/unlisted languages (excluding the current one).
 */
export async function searchLanguages(query: string, excludeLanguageId: string) {
  // Resolve the current user (suspension-aware) so we can include their own languages.
  const { getUserId } = await import("@/lib/auth-helpers")
  const userId = await getUserId()

  const ownClause = userId ? [{ ownerId: userId }] : []

  const languages = await prisma.language.findMany({
    where: {
      id: { not: excludeLanguageId },
      OR: [
        { visibility: "PUBLIC" },
        ...ownClause,
      ],
      AND: query
        ? [{
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }]
        : [],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { dictionaryEntries: true } },
    },
    take: 20,
    orderBy: { name: "asc" },
  })

  return languages
}

/**
 * Search dictionary entries in a specific public language.
 */
export async function searchLanguageDictionary(
  languageId: string,
  query: string
) {
  // Verify the language is public
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { visibility: true, name: true },
  })

  if (!language || language.visibility !== "PUBLIC") {
    return { entries: [], languageName: "" }
  }

  const entries = await prisma.dictionaryEntry.findMany({
    where: {
      languageId,
      OR: [
        { lemma: { contains: query, mode: "insensitive" } },
        { gloss: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      lemma: true,
      gloss: true,
      ipa: true,
      partOfSpeech: true,
    },
    take: 50,
    orderBy: { lemma: "asc" },
  })

  return { entries, languageName: language.name }
}
