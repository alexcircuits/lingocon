import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { Prisma } from "@prisma/client"
import { getTranslations } from "next-intl/server"
import { PublicDictionary, type PublicDictionaryRow } from "./public-dictionary"
import { languageMetadataSchema } from "@/lib/validations/language"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata } from "@/lib/seo"
import { parsePage, parseQuery } from "@/lib/services/dictionary-query"

// Server-side search + pagination. The page used to embed the entire lexicon (every column of
// every entry) in the HTML and filter it in the browser: 19.6 MB and ~800 ms per request for a
// 20k-entry language. Now each request carries one page, and results are linkable/crawlable.
const PAGE_SIZE = 100

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const language = await getLanguageSeoData(slug)
  if (!language) return { title: "Dictionary Not Found", robots: { index: false, follow: false } }

  return buildLanguageMetadata(language, {
    section: "dictionary",
    sectionLabel: "Dictionary",
    description: `Browse the ${language.name} dictionary — word definitions, IPA pronunciations, and lexicon for the ${language.name} constructed language on LingoCon.`,
    keywords: [`${language.name} lexicon`, `${language.name} words`, `${language.name} vocabulary`],
  })
}

type SearchParams = { q?: string; page?: string; tag?: string; dir?: string }

function buildWhere(languageId: string, query: string, reversed: boolean, tag: string): Prisma.DictionaryEntryWhereInput {
  const where: Prisma.DictionaryEntryWhereInput = { languageId }
  if (tag) where.tags = { array_contains: [tag] }
  if (query) {
    where.OR = reversed
      ? [
          { gloss: { contains: query, mode: "insensitive" } },
          { lemma: { contains: query, mode: "insensitive" } },
        ]
      : [
          { lemma: { contains: query, mode: "insensitive" } },
          { gloss: { contains: query, mode: "insensitive" } },
          { ipa: { contains: query, mode: "insensitive" } },
          { partOfSpeech: { contains: query, mode: "insensitive" } },
        ]
  }
  return where
}

export default async function DictionaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const sp = await searchParams
  const query = parseQuery(sp.q)
  const tag = parseQuery(sp.tag).toLowerCase()
  const reversed = sp.dir === "meaning"
  const requestedPage = parsePage(sp.page)

  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      visibility: true,
      metadata: true,
      scriptSymbols: { orderBy: { order: "asc" } },
    },
  })
  if (!language || language.visibility === "PRIVATE") {
    notFound()
  }

  const where = buildWhere(language.id, query, reversed, tag)
  const [total, languageTotal] = await Promise.all([
    prisma.dictionaryEntry.count({ where }),
    prisma.dictionaryEntry.count({ where: { languageId: language.id } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

  const rows = await prisma.dictionaryEntry.findMany({
    where,
    orderBy: reversed ? [{ gloss: "asc" }, { id: "asc" }] : [{ lemma: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      lemma: true,
      gloss: true,
      ipa: true,
      partOfSpeech: true,
      audioUrl: true,
      // Only to compute the "has details" dot; the long text stays on the server.
      etymology: true,
      notes: true,
      relatedWords: true,
    },
  })

  const entries: PublicDictionaryRow[] = rows.map(({ etymology, notes, relatedWords, ...row }) => ({
    ...row,
    hasDetails: !!(etymology || notes || (Array.isArray(relatedWords) && relatedWords.length > 0)),
  }))

  const metadata = languageMetadataSchema.safeParse(language.metadata ?? {}).data
  const t = await getTranslations("langPublic.dictionary")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <PublicDictionary
        entries={entries}
        symbols={language.scriptSymbols}
        languageTotal={languageTotal}
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        initialQuery={query}
        reversed={reversed}
        activeTag={tag || null}
        voiceId={metadata?.tts?.voiceId}
        speed={metadata?.tts?.speed}
      />
    </div>
  )
}
