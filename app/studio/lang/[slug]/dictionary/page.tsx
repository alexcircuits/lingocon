import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { DictionaryManager } from "./dictionary-manager"
import {
  buildDictionarySearchWhere,
  dictionaryOrderBy,
  parsePage,
  parseQuery,
  parseSearchField,
  parseSort,
  type DictionarySearchField,
  type DictionarySort,
} from "@/lib/services/dictionary-query"
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

async function getDictionaryEntries(
  languageId: string,
  page: number,
  query: string,
  field: DictionarySearchField | undefined,
  sort: DictionarySort
) {
  const where = buildDictionarySearchWhere(languageId, query, field)

  const [entries, total] = await Promise.all([
    prisma.dictionaryEntry.findMany({
      where,
      orderBy: dictionaryOrderBy(sort),
      take: ITEMS_PER_PAGE,
      skip: (page - 1) * ITEMS_PER_PAGE,
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

  const page = parsePage(pageParam)
  const query = parseQuery(queryParam)
  const field = parseSearchField(fieldParam)
  const sort = parseSort(sortParam)

  const language = await getLanguageDetails(slug, userId)
  const t = await getTranslations("studio.dictionary")

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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">
          {t("pageDescription")}
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
          initialField={field ?? ""}
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
