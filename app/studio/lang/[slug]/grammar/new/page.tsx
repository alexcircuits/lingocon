import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { GrammarEditor } from "../grammar-editor"

async function getLanguage(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      scriptSymbols: {
        orderBy: {
          order: "asc",
        },
      },
      grammarPages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          slug: true,
          order: true,
        },
      },
    },
  })

  if (!language) {
    return null
  }

  // The create form is only for visitors who may create pages (write:grammar, as
  // createGrammarPage requires) - skip in dev mode
  if (process.env.DEV_MODE !== "true" && userId) {
    const canCreate = await canEditScope(language.id, userId, "write:grammar")
    if (!canCreate) {
      return null
    }
  }

  return language
}

export default async function NewGrammarPage({
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

  const maxOrder = language.grammarPages.reduce((max, p) => Math.max(max, p.order), -1)
  const nextOrder = maxOrder + 1

  return (
    <GrammarEditor
      languageId={language.id}
      languageSlug={slug}
      order={nextOrder}
      symbols={language.scriptSymbols}
      grammarPages={language.grammarPages.map(p => ({ id: p.id, title: p.title, slug: p.slug }))}
    />
  )
}

