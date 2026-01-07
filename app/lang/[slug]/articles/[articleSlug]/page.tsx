import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, User } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Metadata } from "next"
import { GrammarContent } from "@/components/grammar-content"
import { ArticleSidebar } from "@/components/article-sidebar"

import { auth } from "@/auth"

export const dynamic = "force-dynamic"

async function getArticleData(languageSlug: string, articleSlug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      ownerId: true,
      articles: {
        where: {
          published: true,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          publishedAt: true,
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 20,
      },
    },
  })

  console.log(`[Debug] getting article data for lang=${languageSlug} article=${articleSlug} user=${userId}`)

  // 1. Check language existence and visibility
  if (!language) {
    console.log(`[Debug] Language not found: ${languageSlug}`)
    return null
  }

  const isOwner = userId === language.ownerId
  const isDev = process.env.DEV_MODE === "true"
  const canViewPrivate = isOwner || isDev

  if (language.visibility === "PRIVATE" && !canViewPrivate) {
    console.log(`[Debug] Language is private and user is not owner/dev: ${languageSlug}`)
    return null
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
      createdAt: true,
      updatedAt: true,
      published: true,
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // 2. Check article existence
  if (!article) {
    console.log(`[Debug] Article not found in db: ${articleSlug} for language ${language.id}`)
    return null
  }

  // 3. Check article visibility (drafts are visible to owner)
  if (!article.published && !canViewPrivate) {
    console.log(`[Debug] Article unpublished and user not owner`)
    return null
  }

  return { language, article, otherArticles: language.articles }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; articleSlug: string }>
}): Promise<Metadata> {
  const { slug, articleSlug } = await params
  const session = await auth()
  const userId = session?.user?.id || null
  const result = await getArticleData(slug, articleSlug, userId)

  if (!result) {
    return { title: "Article Not Found" }
  }

  return {
    title: `${result.article.title} — ${result.language.name}`,
    description: `Read "${result.article.title}" about ${result.language.name}`,
  }
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string; articleSlug: string }>
}) {
  const { slug, articleSlug } = await params
  const session = await auth()
  const userId = session?.user?.id || null
  const result = await getArticleData(slug, articleSlug, userId)

  if (!result) {
    notFound()
  }

  const { language, article, otherArticles } = result

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <ArticleSidebar
        languageSlug={slug}
        articles={otherArticles}
        currentSlug={articleSlug}
      />

      <div className="flex-1 min-w-0 py-6 lg:py-8">
        <article className="max-w-3xl mx-auto">
          <header className="mb-8 border-b pb-6">
            <Badge variant="secondary" className="mb-4 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
              Article
            </Badge>
            <h1 className="text-3xl md:text-4xl font-serif font-medium mb-4 tracking-tight">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {article.author.name || "Anonymous"}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(article.createdAt, "MMMM d, yyyy")}
              </span>
            </div>
          </header>

          {article.coverImage && (
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/40 bg-secondary/30 mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.coverImage}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="prose prose-slate dark:prose-invert max-w-none
            prose-headings:font-serif prose-headings:font-medium
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl">
            <GrammarContent content={article.content} />
          </div>
        </article>
      </div>
    </div>
  )
}

