import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PublicAlphabetView } from "./public-alphabet-view"

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

      <PublicAlphabetView symbols={language.scriptSymbols} />
    </div>
  )
}

