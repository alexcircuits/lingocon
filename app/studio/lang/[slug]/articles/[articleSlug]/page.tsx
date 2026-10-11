import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { ArticleEditor } from "../article-editor"

/** The visitor's article scopes, authorized before any article is read. Null: no access at all. */
async function articleScopes(languageId: string, userId: string | null) {
  // Dev mode without a user keeps full access (as before).
  if (process.env.DEV_MODE === "true" || !userId) return { canWrite: true, canDraft: false }
  const { canEditScope, canViewLanguage } = await import("@/lib/auth-helpers")
  const [canWrite, canDraft] = await Promise.all([
    canEditScope(languageId, userId, "write:articles"),
    canEditScope(languageId, userId, "draft:articles"),
  ])
  if (canWrite || canDraft) return { canWrite, canDraft }
  // Viewers (and anyone opening a public project's studio) may read published articles.
  return (await canViewLanguage(languageId, userId)) ? { canWrite: false, canDraft: false } : null
}

async function getArticle(languageSlug: string, articleSlug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      grammarPages: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, slug: true },
      },
    },
  })

  if (!language) {
    return null
  }

  const scopes = await articleScopes(language.id, userId)
  if (!scopes) return { language, article: null, readOnly: true }

  const found = await prisma.article.findUnique({
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
      published: true,
      authorId: true,
      // The editor's revision token (optimistic concurrency on save).
      updatedAt: true,
    },
  })
  if (!found) return { language, article: null, readOnly: true }

  // The server's update rule: write:articles, or the draft:articles author of an unpublished
  // article. Anyone else may only read it, and only once it is published.
  const { authorId, ...article } = found
  const editable =
    scopes.canWrite || (scopes.canDraft && authorId === userId && !article.published)
  if (!editable && !article.published) return { language, article: null, readOnly: true }

  return { language, article, readOnly: !editable }
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
      grammarPages={result.language.grammarPages}
      readOnly={result.readOnly}
    />
  )
}
