import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { SoundChangeEditor } from "./sound-change-editor"

async function getLanguageDetails(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      metadata: true,
      dictionaryEntries: {
        select: {
          id: true,
          lemma: true,
          gloss: true,
          ipa: true,
        },
        orderBy: { lemma: "asc" },
      },
    },
  })

  if (!language) return null

  if (process.env.DEV_MODE !== "true" && userId) {
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) return null
  }

  return language
}

export default async function SoundChangesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const userId = await getUserId()

  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const language = await getLanguageDetails(slug, userId)

  if (!language) {
    notFound()
  }

  const metadata = (language.metadata as Record<string, any>) || {}
  const savedRules = metadata.soundChangeRules || ""
  const phonology = metadata.phonology || {}

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-3xl font-serif tracking-tight mb-1">Sound Changes</h1>
        <p className="text-muted-foreground">
          Define ordered phonological rules and apply them to derive daughter language forms
        </p>
      </div>

      <SoundChangeEditor
        languageId={language.id}
        languageName={language.name}
        entries={language.dictionaryEntries}
        savedRules={savedRules}
        phonology={phonology}
      />
    </div>
  )
}
