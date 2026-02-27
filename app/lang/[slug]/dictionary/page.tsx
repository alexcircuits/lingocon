import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PublicDictionary } from "./public-dictionary"

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    include: {
      dictionaryEntries: {
        orderBy: {
          lemma: "asc",
        },
        include: {
          exampleSentences: {
            orderBy: { order: "asc" },
          },
        },
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
        voiceId={(language.metadata as any)?.tts?.voiceId}
        speed={(language.metadata as any)?.tts?.speed}
      />
    </div>
  )
}
