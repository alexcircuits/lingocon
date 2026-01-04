import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GrammarPagesManager } from "./grammar-pages-manager"

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

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif tracking-tight mb-1">Grammar</h1>
          <p className="text-muted-foreground">
            Create and organize grammar documentation pages
          </p>
        </div>
        <Link href={`/studio/lang/${slug}/grammar/new`}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Page
          </Button>
        </Link>
      </div>

      <GrammarPagesManager languageId={language.id} languageSlug={slug} pages={language.grammarPages} />
    </div>
  )
}
