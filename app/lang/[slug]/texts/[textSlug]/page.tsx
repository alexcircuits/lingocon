import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, User, Calendar, BookMarked } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Metadata } from "next"
import { GrammarContent } from "@/components/grammar-content"
import { TextSidebar } from "@/components/text-sidebar"
import { auth } from "@/auth"

async function getTextData(languageSlug: string, textSlug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      ownerId: true,
      texts: {
        where: {
          published: true,
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
    },
  })

  if (!language) {
    return null
  }

  const isOwner = userId === language.ownerId
  const isDev = process.env.DEV_MODE === "true"
  const canViewPrivate = isOwner || isDev

  if (language.visibility === "PRIVATE" && !canViewPrivate) {
    return null
  }

  const text = await prisma.text.findUnique({
    where: {
      languageId_slug: {
        languageId: language.id,
        slug: textSlug,
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      coverImage: true,
      createdAt: true,
      published: true,
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!text) {
    return null
  }

  // Check visibility (drafts are visible to owner)
  if (!text.published && !canViewPrivate) {
    return null
  }

  return { language, text, otherTexts: language.texts }
}

function getWordCount(content: any): number {
  if (!content) return 0
  if (typeof content === 'string') {
    return content.split(/\s+/).filter(Boolean).length
  }
  // If it's TipTap JSON
  if (content.content && Array.isArray(content.content)) {
    let count = 0
    const extractText = (node: any) => {
      if (node.text) count += node.text.split(/\s+/).filter(Boolean).length
      if (node.content) node.content.forEach(extractText)
    }
    content.content.forEach(extractText)
    return count
  }
  return 0
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; textSlug: string }>
}): Promise<Metadata> {
  const { slug, textSlug } = await params
  const session = await auth()
  const userId = session?.user?.id || null
  const result = await getTextData(slug, textSlug, userId)

  if (!result) {
    return { title: "Text Not Found" }
  }

  return {
    title: `${result.text.title} — ${result.language.name}`,
    description: `Read "${result.text.title}" in ${result.language.name}`,
  }
}

export default async function PublicTextPage({
  params,
}: {
  params: Promise<{ slug: string; textSlug: string }>
}) {
  const { slug, textSlug } = await params
  const session = await auth()
  const userId = session?.user?.id || null
  const result = await getTextData(slug, textSlug, userId)

  if (!result) {
    notFound()
  }

  const { language, text, otherTexts } = result
  const wordCount = getWordCount(text.content)

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <TextSidebar
        languageSlug={slug}
        texts={otherTexts}
        currentSlug={textSlug}
      />

      <div className="flex-1 min-w-0 py-6 lg:py-8">
        <article className="max-w-3xl mx-auto">
          <header className="mb-8 border-b pb-6">
            <Badge variant="secondary" className="mb-4 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20">
              Text
            </Badge>
            <h1 className="text-3xl md:text-4xl font-serif font-medium mb-4 tracking-tight">
              {text.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {text.author.name || "Anonymous"}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(text.createdAt, "MMMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {wordCount.toLocaleString()} words
              </span>
            </div>
          </header>

          {text.coverImage && (
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/40 bg-secondary/30 mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={text.coverImage}
                alt={text.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="prose prose-slate dark:prose-invert max-w-none
            prose-headings:font-serif prose-headings:font-medium
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl">
            <GrammarContent content={text.content} />
          </div>
        </article>
      </div>
    </div>
  )
}


