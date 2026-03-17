import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { ShareButtons } from "@/components/share-buttons"
import { FavoriteButton } from "@/components/favorite-button"
import { Languages, BookOpen, FileText, ArrowRight, Calendar, Clock, Newspaper, BookMarked, Flag, Globe, MessageSquare, MessageCircle, Heart } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { LanguageHero } from "./components/language-hero"
import { NavBento } from "./components/nav-bento"
import { formatDistanceToNow } from "date-fns"
import { getUserId } from "@/lib/auth-helpers"
import { checkIsFavorite, getFavoriteCount } from "@/app/actions/favorite"
import { getComments } from "@/app/actions/comment"
import { CommentSection } from "@/components/comments/comment-section"
import { getLanguageFamilyTree } from "@/app/actions/language-family"
import { LanguageFamilyTree } from "@/components/language-family-tree"
import { FamilyTreeErrorBoundary } from "@/components/family-tree-error-boundary"

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      visibility: true,
      ownerId: true,
      flagUrl: true,
      discordUrl: true,
      telegramUrl: true,
      websiteUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
          articles: true,
          texts: true,
          favorites: true,
        },
      },
      articles: {
        where: { published: true },
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          createdAt: true,
        },
      },
      texts: {
        where: { published: true },
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  })

  if (!language) {
    return null
  }

  if (language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const language = await getLanguage(slug)

  if (!language) {
    return {
      title: "Language Not Found",
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com"
  const url = `${siteUrl}/lang/${language.slug}`
  const title = `${language.name} — Language Documentation`

  // Generate a rich description based on content
  let description = language.description

  if (!description) {
    const parts = []
    if (language._count.dictionaryEntries > 0) parts.push(`${language._count.dictionaryEntries} dictionary entries`)
    if (language._count.grammarPages > 0) parts.push("grammar documentation")
    if (language._count.texts > 0) parts.push("translated texts")
    if (language._count.scriptSymbols > 0) parts.push("custom script")

    const contentSummary = parts.length > 0 ? ` featuring ${parts.join(", ")}` : ""
    description = `Explore ${language.name} language documentation${contentSummary} on LingoCon.`
  }

  const ogImageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://lingocon.com"}/api/og/family-tree/${language.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "LingoCon",
      type: "website",
      locale: "en_US",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${language.name} language family tree`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: url,
    },
  }
}

export default async function PublicLanguagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)

  if (!language) {
    notFound()
  }

  const userId = await getUserId()
  const [isFavorite, comments] = await Promise.all([
    userId ? checkIsFavorite(language.id, userId) : false,
    getComments(language.id),
  ])

  let familyTree = null
  try {
    familyTree = await getLanguageFamilyTree(language.id)
  } catch {}

  const isOwner = userId === (language as any).ownerId

  const sections = [
    {
      title: "Script Symbols",
      count: language._count.scriptSymbols,
      href: `/lang/${language.slug}/alphabet`,
      iconName: "Languages" as const,
      color: "text-primary",
    },
    {
      title: "Phonology",
      count: language._count.scriptSymbols, // shows symbol count as proxy for phonemes
      href: `/lang/${language.slug}/phonology`,
      iconName: "AudioWaveform" as const,
      color: "text-cyan-500",
    },
    {
      title: "Grammar Pages",
      count: language._count.grammarPages,
      href: `/lang/${language.slug}/grammar`,
      iconName: "BookOpen" as const,
      color: "text-violet-500",
    },
    {
      title: "Dictionary Entries",
      count: language._count.dictionaryEntries,
      href: `/lang/${language.slug}/dictionary`,
      iconName: "FileText" as const,
      color: "text-emerald-500",
    },
    {
      title: "Articles",
      count: language._count.articles,
      href: `/lang/${language.slug}/articles`,
      iconName: "Newspaper" as const,
      color: "text-amber-500",
    },
    {
      title: "Texts & Books",
      count: language._count.texts,
      href: `/lang/${language.slug}/texts`,
      iconName: "BookMarked" as const,
      color: "text-rose-500",
    },
  ]

  return (
    <div className="space-y-12 pb-20">
      <LanguageHero language={language} isFavorite={isFavorite} userId={userId} />

      {/* Language Family */}
      {familyTree && (
        <section>
          <h2 className="text-2xl font-serif font-medium mb-6 px-2 flex items-center gap-2">
            Language Family
            <div className="h-px bg-border flex-1 ml-4" />
          </h2>
          <div className="bg-card border-none rounded-2xl p-6 lg:p-10 shadow-sm ring-1 ring-border/50">
            <FamilyTreeErrorBoundary>
              <LanguageFamilyTree
                tree={familyTree}
                currentSlug={slug}
                linkPrefix="public"
              />
            </FamilyTreeErrorBoundary>
          </div>
        </section>
      )}

      {/* Navigation Grid */}
      <section>
        <h2 className="text-2xl font-serif font-medium mb-6 px-2 flex items-center gap-2">
          Explore Corpus
          <div className="h-px bg-border flex-1 ml-4" />
        </h2>
        <NavBento sections={sections} />
      </section>

      {/* Content Feed */}
      {(language.articles.length > 0 || language.texts.length > 0) && (
        <div className="grid gap-12 md:grid-cols-2">
          {/* Recent Articles */}
          {language.articles.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-amber-500" />
                  Latest Articles
                </h3>
                <Link href={`/lang/${language.slug}/articles`} className="text-sm text-primary hover:underline">
                  View All
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {language.articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/lang/${language.slug}/articles/${article.slug}`}
                    className="group flex flex-col p-5 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all hover:border-primary/20"
                  >
                    <span className="font-serif text-lg group-hover:text-primary transition-colors">{article.title}</span>
                    <span className="text-xs text-muted-foreground mt-2 font-mono">
                      {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent Texts */}
          {language.texts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <BookMarked className="h-5 w-5 text-rose-500" />
                  Recent Texts
                </h3>
                <Link href={`/lang/${language.slug}/texts`} className="text-sm text-primary hover:underline">
                  View All
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {language.texts.map((text) => (
                  <Link
                    key={text.id}
                    href={`/lang/${language.slug}/texts/${text.slug}`}
                    className="group flex flex-col p-5 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all hover:border-primary/20"
                  >
                    <span className="font-serif text-lg group-hover:text-primary transition-colors">{text.title}</span>
                    <span className="text-xs text-muted-foreground mt-2 font-mono">
                      Read Text
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Meta/About */}
      <section className="border-t border-border/40 pt-10">
        <div className="grid gap-6 sm:grid-cols-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4" />
            <span>Created {formatDate(language.createdAt, "MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4" />
            <span>Updated {formatDate(language.updatedAt, "MMMM d, yyyy")}</span>
          </div>
        </div>
      </section>

      {/* Comments */}
      <section className="border-t border-border/40 pt-10">
        <CommentSection
          comments={comments}
          languageId={language.id}
          currentUserId={userId}
          isOwner={isOwner}
        />
      </section>
    </div>
  )
}
