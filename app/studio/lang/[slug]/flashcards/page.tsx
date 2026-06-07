import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { getTranslations } from "next-intl/server"
import { redirect, notFound } from "next/navigation"
import { FlashcardSession } from "./flashcard-session"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [language, t] = await Promise.all([
    prisma.language.findUnique({ where: { slug }, select: { name: true } }),
    getTranslations("studio.flashcards"),
  ])
  return {
    title: language ? t("metaTitleWith", { name: language.name }) : t("metaTitle"),
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
    <div className="mx-auto max-w-3xl">
      <FlashcardSession
        entries={language.dictionaryEntries}
        languageName={language.name}
        languageSlug={language.slug}
      />
    </div>
  )
}
