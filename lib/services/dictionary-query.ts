/**
 * Parsing and Prisma filter building for dictionary list views (studio manager and public
 * dictionary). Everything that arrives via the URL is untrusted: the search field is allow-listed
 * so a crafted `?f=languageId` can never widen the query beyond the language being viewed, and the
 * page number is clamped so `?page=-1` cannot reach Prisma as a negative `skip`.
 */
import type { Prisma } from "@prisma/client"

export const DICTIONARY_SEARCH_FIELDS = ["lemma", "gloss", "ipa", "partOfSpeech", "tags"] as const
export type DictionarySearchField = (typeof DICTIONARY_SEARCH_FIELDS)[number]

export const DICTIONARY_SORTS = ["lemma", "createdAt", "partOfSpeech", "gloss"] as const
export type DictionarySort = (typeof DICTIONARY_SORTS)[number]

const MAX_QUERY_LENGTH = 200
const MAX_PAGE = 100_000

export function parseSearchField(value: string | undefined | null): DictionarySearchField | undefined {
  return DICTIONARY_SEARCH_FIELDS.find((field) => field === value)
}

export function parseSort(value: string | undefined | null): DictionarySort {
  return DICTIONARY_SORTS.find((sort) => sort === value) ?? "lemma"
}

export function parsePage(value: string | undefined | null): number {
  const page = Math.floor(Number(value))
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(page, MAX_PAGE)
}

export function parseQuery(value: string | undefined | null): string {
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH)
}

export function buildDictionarySearchWhere(
  languageId: string,
  query: string,
  field?: DictionarySearchField
): Prisma.DictionaryEntryWhereInput {
  if (!query) return { languageId }

  if (field === "tags") {
    return { languageId, tags: { array_contains: [query.toLowerCase()] } }
  }

  if (field) {
    return { languageId, [field]: { contains: query, mode: "insensitive" } }
  }

  return {
    languageId,
    OR: [
      { lemma: { contains: query, mode: "insensitive" } },
      { gloss: { contains: query, mode: "insensitive" } },
      { ipa: { contains: query, mode: "insensitive" } },
      { partOfSpeech: { contains: query, mode: "insensitive" } },
    ],
  }
}

export function dictionaryOrderBy(sort: DictionarySort): Prisma.DictionaryEntryOrderByWithRelationInput[] {
  // `id` breaks ties so pagination is stable when many entries share a lemma/gloss/POS.
  switch (sort) {
    case "createdAt":
      return [{ createdAt: "desc" }, { id: "asc" }]
    case "partOfSpeech":
      return [{ partOfSpeech: "asc" }, { lemma: "asc" }, { id: "asc" }]
    case "gloss":
      return [{ gloss: "asc" }, { id: "asc" }]
    default:
      return [{ lemma: "asc" }, { id: "asc" }]
  }
}
