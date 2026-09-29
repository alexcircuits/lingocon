/**
 * Per-language content counts in one round trip.
 *
 * Prisma compiles `_count: { select: { dictionaryEntries: true } }` on a single language into
 * `LEFT JOIN (SELECT "languageId", COUNT(*) FROM dictionary_entries GROUP BY "languageId")` —
 * it counts the rows of *every* language and then joins one. Measured 5.0 ms vs 0.17 ms for a
 * per-language count with 28k entries platform-wide, and the gap grows with the whole platform.
 * This issues a single statement of scalar subqueries, each an index-only count for one language.
 */
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// Fixed SQL fragments (never user input) keyed by the name callers use.
const COUNT_SQL = {
  scriptSymbols: Prisma.sql`SELECT count(*) FROM script_symbols WHERE "languageId" = l.id`,
  grammarPages: Prisma.sql`SELECT count(*) FROM grammar_pages WHERE "languageId" = l.id`,
  dictionaryEntries: Prisma.sql`SELECT count(*) FROM dictionary_entries WHERE "languageId" = l.id`,
  paradigms: Prisma.sql`SELECT count(*) FROM paradigms WHERE "languageId" = l.id`,
  articles: Prisma.sql`SELECT count(*) FROM articles WHERE "languageId" = l.id`,
  texts: Prisma.sql`SELECT count(*) FROM texts WHERE "languageId" = l.id`,
  favorites: Prisma.sql`SELECT count(*) FROM favorites WHERE "languageId" = l.id`,
  publishedCourses: Prisma.sql`SELECT count(*) FROM courses WHERE "languageId" = l.id AND visibility = 'PUBLISHED'`,
} as const

export type LanguageCountKey = keyof typeof COUNT_SQL

export async function getLanguageCounts<K extends LanguageCountKey>(
  languageId: string,
  keys: readonly K[]
): Promise<Record<K, number>> {
  const columns = keys.map((key) => Prisma.sql`(${COUNT_SQL[key]}) AS ${Prisma.raw(`"${key}"`)}`)
  const rows = await prisma.$queryRaw<Record<string, bigint | number>[]>`
    SELECT ${Prisma.join(columns)} FROM languages l WHERE l.id = ${languageId}`
  const row = rows[0] ?? {}
  return Object.fromEntries(keys.map((key) => [key, Number(row[key] ?? 0)])) as Record<K, number>
}
