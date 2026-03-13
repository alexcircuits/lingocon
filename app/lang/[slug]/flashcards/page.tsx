import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { FlashcardSession } from "@/app/studio/lang/[slug]/flashcards/flashcard-session"
import { Navbar } from "@/components/navbar"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const language = await prisma.language.findUnique({
    where: { slug },
    select: { name: true },
  })
  return {
    title: language ? `Study ${language.name} — Flashcards` : "Study Flashcards",
    description: language ? `Practice vocabulary for ${language.name} with flashcards and quizzes.` : undefined,
  }
}

export default async function PublicFlashcardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"

  const language = await prisma.language.findUnique({
    where: { slug, visibility: "PUBLIC" },
    select: {
      id: true,
      name: true,
      slug: true,
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

  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user as any} isDevMode={isDevMode} />
      <div className="h-14" />
      <div className="container mx-auto py-8 px-4">
        <FlashcardSession
          entries={language.dictionaryEntries}
          languageName={language.name}
          languageSlug={language.slug}
          isPublic
        />
      </div>
    </div>
  )
}
