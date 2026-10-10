import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { GrammarEditor } from "../grammar-editor"

async function getGrammarPage(languageSlug: string, pageSlug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
    select: {
      id: true,
      ownerId: true,
      scriptSymbols: {
        select: { id: true, symbol: true, ipa: true, latin: true, name: true, order: true },
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

  // Only the edited page's document is loaded; the other pages are wiki-link targets and need
  // just their titles and slugs.
  const [page, otherPages] = await Promise.all([
    prisma.grammarPage.findUnique({
      where: { languageId_slug: { languageId: language.id, slug: pageSlug } },
    }),
    prisma.grammarPage.findMany({
      where: { languageId: language.id, slug: { not: pageSlug } },
      select: { id: true, title: true, slug: true },
      orderBy: { order: "asc" },
    }),
  ])

  if (!page) {
    return null
  }

  return { languageId: language.id, page, symbols: language.scriptSymbols, otherPages }
}

export default async function EditGrammarPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug, pageSlug } = await params
  const result = await getGrammarPage(slug, pageSlug, userId)

  if (!result) {
    notFound()
  }

  const { languageId, page, symbols, otherPages } = result

  return (
    <GrammarEditor
      languageId={languageId}
      languageSlug={slug}
      page={page}
      symbols={symbols}
      grammarPages={otherPages}
    />
  )
}

