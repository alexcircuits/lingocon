/**
 * Server-only data helpers for SEO metadata generation.
 *
 * Kept separate from `lib/seo.ts` (which is pure and safe to import anywhere)
 * so Prisma is only pulled into modules that actually query the database.
 */
import { prisma } from "@/lib/prisma"

export type LanguageSeoData = {
  id: string
  name: string
  slug: string
  description: string | null
  flagUrl: string | null
  visibility: string
}

/**
 * Fetch the minimal language fields needed to build page metadata.
 * Returns `null` for missing or PRIVATE languages (which must not be indexed).
 */
export async function getLanguageSeoData(slug: string): Promise<LanguageSeoData | null> {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      flagUrl: true,
      visibility: true,
    },
  })

  if (!language || language.visibility === "PRIVATE") {
    return null
  }

  return language
}
