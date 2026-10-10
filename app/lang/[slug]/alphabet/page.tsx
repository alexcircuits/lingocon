import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PublicAlphabetView } from "./public-alphabet-view"
import { parseLanguageMetadata } from "@/lib/validations/language"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata } from "@/lib/seo"

// No `revalidate` export: this page reads cookies (session, locale), so it is
// rendered per request; studio writes call revalidatePath for it.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const language = await getLanguageSeoData(slug)
  // Decided here, before streaming starts, so a missing page is a real 404 (the page's
  // own notFound() runs inside the loading boundary, after a 200 has been sent).
  if (!language) notFound()

  return buildLanguageMetadata(language, {
    section: "alphabet",
    sectionLabel: "Alphabet & Script",
    description: `Discover the writing system of ${language.name} — script symbols, alphabet, and their phonetic values for the ${language.name} constructed language on LingoCon.`,
    keywords: [`${language.name} alphabet`, `${language.name} script`, `${language.name} writing system`],
  })
}

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      scriptSymbols: {
        orderBy: {
          order: "asc",
        },
      },
      metadata: true,
    },
  })

  if (!language || language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export default async function AlphabetPage({
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
        <h2 className="text-3xl font-bold tracking-tight">Alphabet</h2>
        <p className="mt-2 text-muted-foreground">
          Script symbols and their phonetic representations
        </p>
      </div>

      <PublicAlphabetView
        symbols={language.scriptSymbols}
        voiceId={parseLanguageMetadata(language.metadata).tts?.voiceId}
        speed={parseLanguageMetadata(language.metadata).tts?.speed}
      />
    </div>
  )
}

