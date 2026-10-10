import { prisma } from "@/lib/prisma"
import { getFlashcardPool } from "@/lib/services/flashcard-pool"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { FlashcardSession } from "@/app/studio/lang/[slug]/flashcards/flashcard-session"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const language = await getLanguageSeoData(slug)
  // Decided here, before streaming starts, so a missing page is a real 404 (the page's
  // own notFound() runs inside the loading boundary, after a 200 has been sent).
  if (!language || language.visibility !== "PUBLIC") notFound()

  return buildLanguageMetadata(language, {
    section: "flashcards",
    title: `${language.name} — Quick Practice (Flashcards & Quizzes)`,
    description: `Practice ${language.name} vocabulary with quick flashcard and quiz sessions on LingoCon. For spaced-repetition review and progress tracking, enroll in the language.`,
    keywords: [`${language.name} flashcards`, `learn ${language.name}`, `${language.name} vocabulary practice`],
  })
}

export default async function PublicFlashcardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const language = await prisma.language.findUnique({
    where: { slug, visibility: "PUBLIC" },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })

  if (!language) notFound()

  // A bounded sample, not the whole dictionary (see getFlashcardPool).
  const entries = await getFlashcardPool(language.id)

  return (
    <FlashcardSession
      entries={entries}
      languageName={language.name}
      languageSlug={language.slug}
      isPublic
    />
  )
}
