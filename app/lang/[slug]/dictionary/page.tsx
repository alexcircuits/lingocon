import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PublicDictionary } from "./public-dictionary"
import { languageMetadataSchema } from "@/lib/validations/language"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata } from "@/lib/seo"

// Cache public dictionary pages for 1 hour.
export const revalidate = 3600

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

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    include: {
      dictionaryEntries: {
        orderBy: {
          lemma: "asc",
        },
        // Example sentences are intentionally excluded here — they're fetched on
        // demand when the user opens an entry's detail sheet.
      },
      scriptSymbols: {
        orderBy: {
          order: "asc",
        },
      },
    },
  })

  if (!language || language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export default async function DictionaryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dictionary</h2>
        <p className="mt-2 text-muted-foreground">
          Lexicon and word definitions
        </p>
      </div>

      <PublicDictionary
        entries={language.dictionaryEntries}
        symbols={language.scriptSymbols}
        voiceId={languageMetadataSchema.parse(language.metadata ?? {}).tts?.voiceId}
        speed={languageMetadataSchema.parse(language.metadata ?? {}).tts?.speed}
      />
    </div>
  )
}
