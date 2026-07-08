import { prisma } from "@/lib/prisma"
import type { SearchResult, SearchScope } from "@/lib/services/search"

const SIMILARITY_THRESHOLD = 0.3

const EMPTY: SearchResult = { languages: [], entries: [], grammarPages: [], articles: [], texts: [] }

interface EntryRow {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  languageId: string
  languageName: string
  languageSlug: string
  languageFontFamily: string | null
}

interface LanguageRow {
  id: string
  name: string
  slug: string
  description: string | null
  flagUrl: string | null
  ownerName: string | null
  ownerImage: string | null
  scriptSymbols: number
  grammarPages: number
  dictionaryEntries: number
}

interface TitledRow {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  description?: string | null
  type?: string
  languageId: string
  languageName: string
  languageSlug: string
  languageFontFamily?: string | null
}

function shapeEntry(row: EntryRow): SearchResult["entries"][number] {
  return {
    id: row.id,
    lemma: row.lemma,
    gloss: row.gloss,
    ipa: row.ipa,
    language: {
      id: row.languageId,
      name: row.languageName,
      slug: row.languageSlug,
      fontFamily: row.languageFontFamily,
    },
  }
}

async function searchLanguages(query: string, limit: number): Promise<SearchResult["languages"]> {
  const rows = await prisma.$queryRaw<LanguageRow[]>`
    SELECT l."id", l."name", l."slug", l."description", l."flagUrl",
           u."name" AS "ownerName", u."image" AS "ownerImage",
           (SELECT count(*)::int FROM "script_symbols" s WHERE s."languageId" = l."id") AS "scriptSymbols",
           (SELECT count(*)::int FROM "grammar_pages" g WHERE g."languageId" = l."id") AS "grammarPages",
           (SELECT count(*)::int FROM "dictionary_entries" d WHERE d."languageId" = l."id") AS "dictionaryEntries"
    FROM "languages" l
    JOIN "users" u ON u."id" = l."ownerId"
    WHERE l."visibility" = 'PUBLIC'
      AND l."searchVector" @@ websearch_to_tsquery('simple', ${query})
    ORDER BY ts_rank(l."searchVector", websearch_to_tsquery('simple', ${query})) DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    flagUrl: row.flagUrl,
    owner: { name: row.ownerName, image: row.ownerImage },
    _count: {
      scriptSymbols: row.scriptSymbols,
      grammarPages: row.grammarPages,
      dictionaryEntries: row.dictionaryEntries,
    },
  }))
}

// Match entries by their headword/gloss/ipa (FTS, with a trigram fuzzy fallback).
async function entryTextRows(query: string, limit: number): Promise<EntryRow[]> {
  const ftsRows = await prisma.$queryRaw<EntryRow[]>`
    SELECT e."id", e."lemma", e."gloss", e."ipa",
           l."id" AS "languageId", l."name" AS "languageName", l."slug" AS "languageSlug",
           l."fontFamily" AS "languageFontFamily"
    FROM "dictionary_entries" e
    JOIN "languages" l ON l."id" = e."languageId"
    WHERE l."visibility" = 'PUBLIC'
      AND e."searchVector" @@ websearch_to_tsquery('simple', ${query})
    ORDER BY ts_rank(e."searchVector", websearch_to_tsquery('simple', ${query})) DESC
    LIMIT ${limit}
  `
  if (ftsRows.length > 0) return ftsRows

  // Typo-tolerant fallback: trigram similarity on lemma/ipa only (the columns
  // with gin_trgm_ops indexes). Deliberately excludes gloss — fuzzy matching
  // targets unfamiliar conlang spellings, not native-language glosses.
  return prisma.$queryRaw<EntryRow[]>`
    SELECT e."id", e."lemma", e."gloss", e."ipa",
           l."id" AS "languageId", l."name" AS "languageName", l."slug" AS "languageSlug",
           l."fontFamily" AS "languageFontFamily"
    FROM "dictionary_entries" e
    JOIN "languages" l ON l."id" = e."languageId"
    WHERE l."visibility" = 'PUBLIC'
      AND greatest(similarity(e."lemma", ${query}), similarity(coalesce(e."ipa", ''), ${query})) > ${SIMILARITY_THRESHOLD}
    ORDER BY greatest(similarity(e."lemma", ${query}), similarity(coalesce(e."ipa", ''), ${query})) DESC
    LIMIT ${limit}
  `
}

// Match entries by one of their auto-generated INFLECTED forms — so searching
// "ran" (a materialized form) surfaces the base entry "run". Exact match wins;
// trigram similarity catches typos. DISTINCT ON collapses multiple matching
// cells of the same entry to one row.
async function inflectedFormRows(query: string, limit: number): Promise<EntryRow[]> {
  // DISTINCT ON must ORDER BY its key first, so the best-similarity row wins
  // *within* each entry; then the outer query re-orders by that score so LIMIT
  // keeps the best matches overall (not an arbitrary id-ordered slice).
  return prisma.$queryRaw<EntryRow[]>`
    SELECT "id", "lemma", "gloss", "ipa",
           "languageId", "languageName", "languageSlug", "languageFontFamily"
    FROM (
      SELECT DISTINCT ON (e."id")
             e."id", e."lemma", e."gloss", e."ipa",
             l."id" AS "languageId", l."name" AS "languageName", l."slug" AS "languageSlug",
             l."fontFamily" AS "languageFontFamily",
             similarity(f."form", ${query}) AS "score"
      FROM "inflected_forms" f
      JOIN "dictionary_entries" e ON e."id" = f."entryId"
      JOIN "languages" l ON l."id" = e."languageId"
      WHERE l."visibility" = 'PUBLIC'
        AND (lower(f."form") = lower(${query}) OR similarity(f."form", ${query}) > ${SIMILARITY_THRESHOLD})
      ORDER BY e."id", similarity(f."form", ${query}) DESC
    ) sub
    ORDER BY "score" DESC
    LIMIT ${limit}
  `
}

async function searchEntries(query: string, limit: number): Promise<SearchResult["entries"]> {
  const [textRows, inflected] = await Promise.all([
    entryTextRows(query, limit),
    inflectedFormRows(query, limit),
  ])
  // Text matches rank first; append inflected-form matches for entries not
  // already surfaced, then cap at the limit.
  const seen = new Set(textRows.map((r) => r.id))
  const merged = [...textRows]
  for (const row of inflected) {
    if (!seen.has(row.id)) {
      seen.add(row.id)
      merged.push(row)
    }
  }
  return merged.slice(0, limit).map(shapeEntry)
}

async function searchGrammarPages(query: string, limit: number): Promise<SearchResult["grammarPages"]> {
  const rows = await prisma.$queryRaw<TitledRow[]>`
    SELECT g."id", g."title", g."slug",
           l."id" AS "languageId", l."name" AS "languageName", l."slug" AS "languageSlug",
           l."fontFamily" AS "languageFontFamily"
    FROM "grammar_pages" g
    JOIN "languages" l ON l."id" = g."languageId"
    WHERE l."visibility" = 'PUBLIC'
      AND g."searchVector" @@ websearch_to_tsquery('simple', ${query})
    ORDER BY ts_rank(g."searchVector", websearch_to_tsquery('simple', ${query})) DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    language: {
      id: row.languageId,
      name: row.languageName,
      slug: row.languageSlug,
      fontFamily: row.languageFontFamily ?? null,
    },
  }))
}

async function searchArticles(query: string, limit: number): Promise<SearchResult["articles"]> {
  const rows = await prisma.$queryRaw<TitledRow[]>`
    SELECT a."id", a."title", a."slug", a."excerpt",
           l."id" AS "languageId", l."name" AS "languageName", l."slug" AS "languageSlug"
    FROM "articles" a
    JOIN "languages" l ON l."id" = a."languageId"
    WHERE a."published" = true
      AND l."visibility" = 'PUBLIC'
      AND a."searchVector" @@ websearch_to_tsquery('simple', ${query})
    ORDER BY ts_rank(a."searchVector", websearch_to_tsquery('simple', ${query})) DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? null,
    language: { id: row.languageId, name: row.languageName, slug: row.languageSlug },
  }))
}

async function searchTexts(query: string, limit: number): Promise<SearchResult["texts"]> {
  const rows = await prisma.$queryRaw<TitledRow[]>`
    SELECT t."id", t."title", t."slug", t."description", t."type"::text AS "type",
           l."id" AS "languageId", l."name" AS "languageName", l."slug" AS "languageSlug"
    FROM "texts" t
    JOIN "languages" l ON l."id" = t."languageId"
    WHERE t."published" = true
      AND l."visibility" = 'PUBLIC'
      AND t."searchVector" @@ websearch_to_tsquery('simple', ${query})
    ORDER BY ts_rank(t."searchVector", websearch_to_tsquery('simple', ${query})) DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    type: row.type ?? "",
    language: { id: row.languageId, name: row.languageName, slug: row.languageSlug },
  }))
}

export async function searchFts(query: string, scope: SearchScope = "all"): Promise<SearchResult> {
  if (!query || query.length < 2) return EMPTY

  const [languages, entries, grammarPages, articles, texts] = await Promise.all([
    scope === "all" || scope === "languages" ? searchLanguages(query, scope === "languages" ? 50 : 5) : [],
    scope === "all" || scope === "dictionary" ? searchEntries(query, scope === "dictionary" ? 50 : 10) : [],
    scope === "all" || scope === "grammar" ? searchGrammarPages(query, scope === "grammar" ? 50 : 10) : [],
    scope === "all" || scope === "articles" ? searchArticles(query, scope === "articles" ? 50 : 5) : [],
    scope === "all" || scope === "texts" ? searchTexts(query, scope === "texts" ? 50 : 5) : [],
  ])

  return { languages, entries, grammarPages, articles, texts }
}
