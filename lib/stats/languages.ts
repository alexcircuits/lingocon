import { prisma } from "@/lib/prisma"

/**
 * Whether a slug names a PUBLIC language, so the statistics only ever store public language slugs:
 * never an owner's private project, an unlisted one (whose slug works like a secret link) or
 * whatever someone typed after /lang/. Cached per process: one indexed lookup per slug per
 * 10 minutes, so a language made private stops being recorded within that time.
 */

const TTL_MS = 10 * 60_000
const MAX_ENTRIES = 2_000

const cache = new Map<string, { isPublic: boolean; expires: number }>()

/** For tests. */
export function __resetLanguageCache(): void {
  cache.clear()
}

export async function isPublicLanguage(slug: string): Promise<boolean> {
  const now = Date.now()
  const hit = cache.get(slug)
  if (hit && hit.expires > now) return hit.isPublic

  const language = await prisma.language.findUnique({ where: { slug }, select: { visibility: true } })
  const isPublic = language?.visibility === "PUBLIC"
  cache.delete(slug)
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(slug, { isPublic, expires: now + TTL_MS })
  return isPublic
}
