import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { FlashcardSession } from "./flashcard-session"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const language = await prisma.language.findUnique({
    where: { slug },
    select: { name: true },
  })
  return {
    title: language ? `Flashcards — ${language.name}` : "Flashcards",
  }
}

export default async function FlashcardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const userId = await getUserId()

  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      dictionaryEntries: {
        select: {
          id: true,
          lemma: true,
          gloss: true,
          ipa: true,
          partOfSpeech: true,
        },
      },
    },
  })

  if (!language) notFound()

  return (
    <div className="container mx-auto py-8 px-4">
      <FlashcardSession
        entries={language.dictionaryEntries}
        languageName={language.name}
        languageSlug={language.slug}
      />
    </div>
  )
}
