import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { ArticleEditor } from "../article-editor"

async function getArticle(languageSlug: string, articleSlug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
    },
  })

  if (!language) {
    return null
  }

  // Allow access if user is owner or collaborator (skip in dev mode)
  if (process.env.DEV_MODE !== "true" && userId) {
    const { canEditLanguage } = await import("@/lib/auth-helpers")
    const canEdit = await canEditLanguage(language.id, userId)
    if (!canEdit) {
      return { language, article: null }
    }
  }

  const article = await prisma.article.findUnique({
    where: {
      languageId_slug: {
        languageId: language.id,
        slug: articleSlug,
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      coverImage: true,
      paradigmId: true,
    },
  })

  return { language, article }
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string; articleSlug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug, articleSlug } = await params
  const result = await getArticle(slug, articleSlug, userId)

  if (!result || !result.language) {
    notFound()
  }

  if (!result.article) {
    notFound()
  }

  return (
    <ArticleEditor
      languageId={result.language.id}
      languageSlug={slug}
      article={result.article}
    />
  )
}

