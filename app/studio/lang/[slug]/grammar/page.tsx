import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GrammarPagesManager } from "./grammar-pages-manager"
import { documentToPlainText } from "@/lib/utils/tiptap-text"

async function getLanguage(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      grammarPages: {
        orderBy: {
          order: "asc",
        },
      },
    },
  })

  if (!language) {
    return null
  }

  // Allow access if user can view (owner, collaborator, or public) - skip in dev mode
  if (process.env.DEV_MODE !== "true" && userId) {
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) {
      return null
    }
  }

  return language
}

export default async function GrammarPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const language = await getLanguage(slug, userId)

  if (!language) {
    notFound()
  }

  // Compute per-page word counts server-side
  const wordCountsById = new Map(
    language.grammarPages.map((p) => {
      const text = documentToPlainText(p.content)
      const count = text.length > 0 ? text.split(/\s+/).length : 0
      return [p.id, count]
    })
  )
  const totalWords = Array.from(wordCountsById.values()).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Grammar</h1>
          <p className="text-muted-foreground">
            Create and organize grammar documentation pages
          </p>
          {language.grammarPages.length > 0 && (
            <span className="mt-2 block text-xs text-muted-foreground tabular-nums sm:hidden">
              {language.grammarPages.length} page{language.grammarPages.length !== 1 ? "s" : ""}
              {" · "}
              {totalWords.toLocaleString()} word{totalWords !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {language.grammarPages.length > 0 && (
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
              {language.grammarPages.length} page{language.grammarPages.length !== 1 ? "s" : ""}
              {" · "}
              {totalWords.toLocaleString()} word{totalWords !== 1 ? "s" : ""}
            </span>
          )}
          <Link href={`/studio/lang/${slug}/grammar/new`}>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Page
            </Button>
          </Link>
        </div>
      </div>

      <GrammarPagesManager
        languageId={language.id}
        languageSlug={slug}
        pages={language.grammarPages}
        wordCountsById={Object.fromEntries(wordCountsById)}
      />
    </div>
  )
}
