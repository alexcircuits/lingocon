import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
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
        orderBy: {
          order: "desc",
        },
        take: 1,
        select: {
          order: true,
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

  const nextOrder =
    language.grammarPages.length > 0
      ? language.grammarPages[0].order + 1
      : 0

  return (
    <GrammarEditor languageId={language.id} languageSlug={slug} order={nextOrder} symbols={language.scriptSymbols} />
  )
}

