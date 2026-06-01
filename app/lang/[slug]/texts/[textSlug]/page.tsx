import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, User, Calendar, BookMarked } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Metadata } from "next"
import { GrammarContent } from "@/components/grammar-content"
import { TextSidebar } from "@/components/text-sidebar"
import { getSiteUrl, languageOgImage, resolveAssetUrl, SITE_NAME, DEFAULT_LOCALE } from "@/lib/seo"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

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
          image: true,
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
    return { title: "Text Not Found", robots: { index: false, follow: false } }
  }

  const { language, text } = result
  const isUnlisted = language.visibility === "UNLISTED"
  const isDraft = !text.published
  const title = `${text.title} — ${language.name}`
  const description = `Read "${text.title}", a text written in ${language.name}, a constructed language documented on ${SITE_NAME}.`
  const url = `${getSiteUrl()}/lang/${language.slug}/texts/${text.slug}`
  const coverImage = resolveAssetUrl(text.coverImage)
  const ogImage = coverImage ?? languageOgImage(language.id)

  return {
    title,
    description,
    ...(isUnlisted || isDraft ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      locale: DEFAULT_LOCALE,
      publishedTime: text.createdAt.toISOString(),
      authors: text.author?.name ? [text.author.name] : undefined,
      images: [{ url: ogImage, width: 1200, height: 630, alt: text.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: url },
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
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">
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
            <div className="relative aspect-video w-full max-w-xl mx-auto rounded-xl overflow-hidden border border-border/40 bg-secondary/30 mb-8">
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
            <GrammarContent content={text.content} className="font-custom-script" languageSlug={slug} />
          </div>
        </article>
      </div>
    </div>
  )
}


