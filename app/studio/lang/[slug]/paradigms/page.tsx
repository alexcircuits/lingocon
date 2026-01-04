import { prisma } from "@/lib/prisma"
import { ParadigmManager } from "./paradigm-manager"

async function getLanguage(slug: string) {
  // The layout already handles access control, so we just need to fetch the language
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      paradigms: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  return language
}

export default async function ParadigmsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)

  // If language doesn't exist, layout will handle 404
  // If we get here, user has access (checked by layout)
  if (!language) {
    return null
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-3xl font-serif tracking-tight mb-1">Paradigm Tables</h1>
        <p className="text-muted-foreground">
          Define declension and conjugation tables for morphological patterns
        </p>
      </div>

      <ParadigmManager languageId={language.id} paradigms={language.paradigms} />
    </div>
  )
}
