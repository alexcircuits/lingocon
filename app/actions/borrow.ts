"use server"

import { prisma } from "@/lib/prisma"

/**
 * Search languages available for borrowing: public languages OR the user's
 * own private/unlisted languages (excluding the current one).
 */
export async function searchLanguages(query: string, excludeLanguageId: string) {
  // Attempt to resolve the current user so we can include their own languages.
  // borrow.ts intentionally keeps this import-free from auth-helpers to avoid
  // a circular dep — use the session directly.
  const { auth } = await import("@/auth")
  const session = await auth()
  const userId = session?.user?.id ?? null

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
