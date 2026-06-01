import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { GrammarContent } from "@/components/grammar-content"
import { GrammarSidebar } from "@/components/grammar-sidebar"
import { GrammarTOC } from "@/components/grammar-toc"
import { Card } from "@/components/ui/card"
import { extractHeadings } from "@/lib/utils/tiptap-headings"
import { documentToPlainText } from "@/lib/utils/tiptap-text"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata, truncate } from "@/lib/seo"

// Public grammar pages are cached for 1 hour; revalidated on content update.
export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>
}): Promise<Metadata> {
  const { slug, pageSlug } = await params
  const language = await getLanguageSeoData(slug)
  if (!language) return { title: "Grammar Page Not Found", robots: { index: false, follow: false } }

  const page = await prisma.grammarPage.findFirst({
    where: { language: { slug }, slug: pageSlug },
    select: { title: true, content: true },
  })
  if (!page) return { title: "Grammar Page Not Found", robots: { index: false, follow: false } }

  const excerpt = documentToPlainText(page.content)

  return buildLanguageMetadata(language, {
    section: `grammar/${pageSlug}`,
    title: `${page.title} — ${language.name} Grammar`,
    description: excerpt
      ? truncate(excerpt, 180)
      : `${page.title}: grammar documentation for the ${language.name} constructed language on LingoCon.`,
    keywords: [`${language.name} grammar`, page.title, `${language.name} ${page.title}`],
  })
}

async function getGrammarData(languageSlug: string, pageSlug: string) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      grammarPages: {
        select: {
          id: true,
          title: true,
          slug: true,
          order: true,
          content: true,
          imageUrl: true,
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  })

  if (!language || language.visibility === "PRIVATE") {
    return null
  }

  const page = language.grammarPages.find(p => p.slug === pageSlug)
  
  if (!page) {
    return null
  }

  return { 
    language, 
    page,
    allPages: language.grammarPages.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      order: p.order
    }))
  }
}

export default async function GrammarPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>
}) {
  const { slug, pageSlug } = await params
  const result = await getGrammarData(slug, pageSlug)

  if (!result) {
    notFound()
  }

  const { language, page, allPages } = result

  const headings = extractHeadings(page.content)

  // Reading time (avg 200 wpm for dense technical text)
  const pageText = documentToPlainText(page.content)
  const wordCount = pageText.length > 0 ? pageText.split(/\s+/).length : 0
  const readingMinutes = Math.max(1, Math.round(wordCount / 200))

  const currentIndex = allPages.findIndex(p => p.slug === pageSlug)
  const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <GrammarSidebar
        languageSlug={slug}
        pages={allPages}
        currentSlug={pageSlug}
      />

      <div className="flex-1 min-w-0 py-6 lg:py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <header className="border-b pb-6">
            <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight text-foreground">
              {page.title}
            </h1>
            {wordCount > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {readingMinutes} min read · {wordCount.toLocaleString()} words
              </p>
            )}
          </header>

          {page.imageUrl && (
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/40 bg-secondary/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.imageUrl}
                alt={page.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex gap-8 items-start">
            <div className="flex-1 min-w-0 prose prose-slate dark:prose-invert max-w-none
              prose-headings:font-serif prose-headings:font-medium
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-xl">
              <GrammarContent content={page.content} languageSlug={slug} />
            </div>
            <GrammarTOC headings={headings} />
          </div>

          {/* Prev / Next navigation */}
          {(prevPage || nextPage) && (
            <nav className="border-t border-border/40 pt-8 flex items-center justify-between gap-4">
              {prevPage ? (
                <Link
                  href={`/lang/${slug}/grammar/${prevPage.slug}`}
                  className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="truncate">{prevPage.title}</span>
                </Link>
              ) : (
                <div />
              )}
              {nextPage ? (
                <Link
                  href={`/lang/${slug}/grammar/${nextPage.slug}`}
                  className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0 text-right"
                >
                  <span className="truncate">{nextPage.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
                <div />
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  )
}

