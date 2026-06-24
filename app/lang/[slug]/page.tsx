import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { ShareButtons } from "@/components/share-buttons"
import { FavoriteButton } from "@/components/favorite-button"
import { Languages, BookOpen, FileText, ArrowRight, Calendar, Clock, Newspaper, BookMarked, Flag, Globe, MessageSquare, MessageCircle, Heart, GraduationCap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { LanguageHero } from "./components/language-hero"
import { MaintainersSection } from "./components/maintainers-section"
import { NavBento } from "./components/nav-bento"
import { formatDistanceToNow } from "date-fns"
import { getUserId } from "@/lib/auth-helpers"
import { checkIsFavorite, getFavoriteCount } from "@/app/actions/favorite"
import { getComments } from "@/app/actions/comment"
import { CommentSection } from "@/components/comments/comment-section"
import { getLanguageFamilyTree } from "@/app/actions/language-family"
import { LanguageFamilyTree } from "@/components/language-family-tree"
import { FamilyTreeErrorBoundary } from "@/components/family-tree-error-boundary"
import { getPublicReaderModules, getVisitorAccountInstalls, getActiveThemeForLanguage } from "@/lib/services/module"
import { ReaderModulesSection } from "@/components/modules/reader-modules-section"
import { themeToStyle } from "@/lib/modules/theme"
import { Palette } from "lucide-react"
import { buildLanguageMetadata, breadcrumbJsonLd, getSiteUrl } from "@/lib/seo"

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
      owner: {
        select: { id: true, name: true, image: true },
      },
      collaborators: {
        where: { role: "EDITOR" },
        select: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
          articles: true,
          texts: true,
          favorites: true,
          courses: { where: { visibility: "PUBLISHED" } },
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
      robots: { index: false, follow: false },
    }
  }

  // Generate a rich, content-aware description when the author hasn't written one.
  let description = language.description
  if (!description) {
    const parts: string[] = []
    if (language._count.dictionaryEntries > 0) parts.push(`${language._count.dictionaryEntries} dictionary entries`)
    if (language._count.grammarPages > 0) parts.push("grammar documentation")
    if (language._count.texts > 0) parts.push("translated texts")
    if (language._count.scriptSymbols > 0) parts.push("a custom script")

    const contentSummary = parts.length > 0 ? ` featuring ${parts.join(", ")}` : ""
    description = `Explore ${language.name}, a constructed language (conlang)${contentSummary}, documented on LingoCon — the free platform for conlang creators.`
  }

  return buildLanguageMetadata(language, { description })
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

  const t = await getTranslations("langPublic")
  const userId = await getUserId()
  const [isFavorite, comments] = await Promise.all([
    userId ? checkIsFavorite(language.id, userId) : false,
    getComments(language.id),
  ])

  let familyTree = null
  try {
    familyTree = await getLanguageFamilyTree(language.id)
  } catch (error) {
    // Non-fatal: the page renders without the family tree.
    console.error("Failed to load language family tree:", error)
  }

  const [readerModules, activeTheme] = await Promise.all([
    getPublicReaderModules(language.ownerId, language.id),
    getActiveThemeForLanguage(language.ownerId, language.id),
  ])
  const visitorInstalls = userId
    ? await getVisitorAccountInstalls(userId, readerModules.map((m) => m.moduleId))
    : {}
  const themeStyle = activeTheme ? themeToStyle(activeTheme.theme) : undefined

  const isOwner = userId === language.ownerId

  const sections = [
    {
      title: t("secSymbols"),
      count: language._count.scriptSymbols,
      href: `/lang/${language.slug}/alphabet`,
      iconName: "Languages" as const,
      color: "text-primary",
    },
    {
      title: t("secPhonology"),
      count: language._count.scriptSymbols, // shows symbol count as proxy for phonemes
      href: `/lang/${language.slug}/phonology`,
      iconName: "AudioWaveform" as const,
      color: "text-primary",
    },
    {
      title: t("secGrammar"),
      count: language._count.grammarPages,
      href: `/lang/${language.slug}/grammar`,
      iconName: "BookOpen" as const,
      color: "text-primary",
    },
    {
      title: t("secDictionary"),
      count: language._count.dictionaryEntries,
      href: `/lang/${language.slug}/dictionary`,
      iconName: "FileText" as const,
      color: "text-primary",
    },
    {
      title: t("secArticles"),
      count: language._count.articles,
      href: `/lang/${language.slug}/articles`,
      iconName: "Newspaper" as const,
      color: "text-primary",
    },
    {
      title: t("secTexts"),
      count: language._count.texts,
      href: `/lang/${language.slug}/texts`,
      iconName: "BookMarked" as const,
      color: "text-primary",
    },
  ]

  const siteUrl = getSiteUrl()

  const breadcrumbSchema = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Browse Languages", path: "/browse" },
    { name: language.name, path: `/lang/${language.slug}` },
  ])

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${language.name} — Constructed Language Documentation`,
    description: language.description || `Documentation for the constructed language ${language.name}, including dictionary entries, grammar pages, and scripts.`,
    url: `${siteUrl}/lang/${language.slug}`,
    creator: { "@type": "Organization", name: "LingoCon", url: siteUrl },
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    keywords: ["conlang", "constructed language", language.name, "linguistics", "grammar", "lexicon"],
  }

  return (
    <div
      className={activeTheme ? "lc-themed space-y-12 rounded-[var(--radius)] pb-20" : "space-y-12 pb-20"}
      style={themeStyle}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />
      <LanguageHero language={language} isFavorite={isFavorite} userId={userId} />

      <MaintainersSection
        owner={language.owner}
        editors={language.collaborators.map((c) => c.user)}
      />

      {/* Learn this language CTA — only when published courses exist */}
      {language._count.courses > 0 && (
        <section>
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-accent/10 p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{t("learnHeading", { name: language.name })}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("learnDesc", { count: language._count.courses })}
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="shrink-0 gap-2">
                <Link href={`/learn/${language.slug}`}>
                  <Sparkles className="h-4 w-4" />
                  {t("startLearning")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Language Family */}
      {familyTree && (
        <section>
          <h2 className="mb-6 flex items-center gap-4 px-2 text-2xl font-bold tracking-tight">
            {t("languageFamily")}
            <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          </h2>
          <div className="aurora-glass rounded-3xl p-6 lg:p-10">
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
        <h2 className="mb-6 flex items-center gap-4 px-2 text-2xl font-bold tracking-tight">
          {t("exploreCorpus")}
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </h2>
        <NavBento sections={sections} />
      </section>

      {/* Modules / Tools */}
      <ReaderModulesSection
        modules={readerModules}
        visitorInstalls={visitorInstalls}
        isAuthenticated={Boolean(userId)}
        languageId={language.id}
        languageSlug={language.slug}
      />

      {/* Content Feed */}
      {(language.articles.length > 0 || language.texts.length > 0) && (
        <div className="grid gap-12 md:grid-cols-2">
          {/* Recent Articles */}
          {language.articles.length > 0 && (
            <section>
              <div className="mb-5 flex items-center justify-between px-2">
                <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  <Newspaper className="h-5 w-5 text-primary" />
                  {t("latestArticles")}
                </h3>
                <Link href={`/lang/${language.slug}/articles`} className="text-sm font-medium text-primary hover:underline">
                  {t("viewAll")}
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {language.articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/lang/${language.slug}/articles/${article.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl aurora-glass p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold transition-colors group-hover:text-primary">{article.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent Texts */}
          {language.texts.length > 0 && (
            <section>
              <div className="mb-5 flex items-center justify-between px-2">
                <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  <BookMarked className="h-5 w-5 text-primary" />
                  {t("recentTexts")}
                </h3>
                <Link href={`/lang/${language.slug}/texts`} className="text-sm font-medium text-primary hover:underline">
                  {t("viewAll")}
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {language.texts.map((text) => (
                  <Link
                    key={text.id}
                    href={`/lang/${language.slug}/texts/${text.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl aurora-glass p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold transition-colors group-hover:text-primary">{text.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t("readText")}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Meta/About */}
      <section className="border-t border-border/40 pt-8">
        <div className="flex flex-wrap gap-2.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 backdrop-blur-sm">
            <Calendar className="h-4 w-4 text-primary" />
            {t("createdOn", { date: formatDate(language.createdAt, "MMMM d, yyyy") })}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 backdrop-blur-sm">
            <Clock className="h-4 w-4 text-primary" />
            {t("updatedOn", { date: formatDate(language.updatedAt, "MMMM d, yyyy") })}
          </span>
          {activeTheme && (
            <Link
              href={`/modules/${activeTheme.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 backdrop-blur-sm transition-colors hover:text-primary"
            >
              <Palette className="h-4 w-4 text-primary" />
              {t("themeLabel", { name: activeTheme.name })}
            </Link>
          )}
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
