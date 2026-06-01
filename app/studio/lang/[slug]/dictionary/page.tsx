import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { DictionaryManager } from "./dictionary-manager"
import { Prisma } from "@prisma/client"
import { Suspense } from "react"
import { EnhancedLoadingSkeleton } from "@/components/enhanced-loading-skeleton"
import { languageMetadataSchema } from "@/lib/validations/language"

const ITEMS_PER_PAGE = 20

async function getLanguageDetails(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      scriptSymbols: {
        orderBy: {
          order: "asc",
        },
      },
      metadata: true,
      allowsDiacritics: true,
    },
  })

  if (!language) return null

  if (process.env.DEV_MODE !== "true" && userId) {
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) return null
  }

  return language
}

type SortOption = "lemma" | "createdAt" | "partOfSpeech" | "gloss"

function getOrderBy(sort: SortOption): Prisma.DictionaryEntryOrderByWithRelationInput {
  switch (sort) {
    case "createdAt": return { createdAt: "desc" }
    case "partOfSpeech": return { partOfSpeech: "asc" }
    case "gloss": return { gloss: "asc" }
    default: return { lemma: "asc" }
  }
}

async function getDictionaryEntries(
  languageId: string,
  page: number,
  query: string,
  field?: string,
  sort: SortOption = "lemma"
) {
  const skip = (page - 1) * ITEMS_PER_PAGE

  const where: Prisma.DictionaryEntryWhereInput = {
    languageId,
    ...(query
      ? field === "tags"
        ? {
          tags: { array_contains: [query.toLowerCase()] },
        }
        : field
          ? {
            [field]: { contains: query, mode: "insensitive" },
          }
          : {
            OR: [
              { lemma: { contains: query, mode: "insensitive" } },
              { gloss: { contains: query, mode: "insensitive" } },
              { ipa: { contains: query, mode: "insensitive" } },
              { partOfSpeech: { contains: query, mode: "insensitive" } },
            ],
          }
      : {}),
  }

  const [entries, total] = await Promise.all([
    prisma.dictionaryEntry.findMany({
      where,
      orderBy: getOrderBy(sort),
      take: ITEMS_PER_PAGE,
      skip,
    }),
    prisma.dictionaryEntry.count({ where }),
  ])

  return {
    entries,
    total,
    totalPages: Math.ceil(total / ITEMS_PER_PAGE),
  }
}

export default async function DictionaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; q?: string; f?: string; sort?: string }>
}) {
  const userId = await getUserId()

  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const { page: pageParam, q: queryParam, f: fieldParam, sort: sortParam } = await searchParams

  const page = Number(pageParam) || 1
  const query = queryParam || ""
  const field = fieldParam || ""
  const sort = (["lemma", "createdAt", "partOfSpeech", "gloss"].includes(sortParam ?? "")
    ? sortParam
    : "lemma") as SortOption

  const language = await getLanguageDetails(slug, userId)

  if (!language) {
    notFound()
  }

  const { entries, total, totalPages } = await getDictionaryEntries(
    language.id,
    page,
    query,
    field,
    sort
  )

  const isAudioEnabled = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION)

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Dictionary</h1>
        <p className="text-muted-foreground">
          Build your lexicon with lemmas, glosses, IPA, and part of speech
        </p>
      </div>

      <Suspense fallback={<EnhancedLoadingSkeleton variant="table" />}>
        <DictionaryManager
          languageId={language.id}
          entries={entries}
          symbols={language.scriptSymbols}
          currentPage={page}
          totalPages={totalPages}
          totalEntries={total}
          initialQuery={query}
          initialField={field}
          initialSort={sort}
          enableAudio={isAudioEnabled}
          ttsSettings={languageMetadataSchema.parse(language.metadata ?? {}).tts}
          allowsDiacritics={language.allowsDiacritics}
          metadata={languageMetadataSchema.parse(language.metadata ?? {})}
          languageName={language.name}
        />
      </Suspense>
    </div>
  )
}
