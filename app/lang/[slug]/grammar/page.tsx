import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen, ChevronRight } from "lucide-react"
import { documentToPlainText } from "@/lib/utils/tiptap-text"
import { getLanguageSeoData } from "@/lib/seo-data"
import { buildLanguageMetadata } from "@/lib/seo"

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const language = await getLanguageSeoData(slug)
  if (!language) return { title: "Grammar Not Found", robots: { index: false, follow: false } }

  return buildLanguageMetadata(language, {
    section: "grammar",
    sectionLabel: "Grammar",
    description: `Grammar documentation for ${language.name} — syntax, morphology, and rules of the ${language.name} constructed language on LingoCon.`,
    keywords: [`${language.name} grammar`, `${language.name} syntax`, `${language.name} morphology`, `${language.name} rules`],
  })
}

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      grammarPages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          imageUrl: true,
          order: true,
        },
      },
    },
  })

  if (!language || language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export default async function GrammarIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)

  if (!language) {
    notFound()
  }

  // Compute excerpts and word counts server-side
  const pages = language.grammarPages.map((page) => {
    const text = documentToPlainText(page.content)
    const words = text.length > 0 ? text.split(/\s+/).length : 0
    const excerpt = text.length > 120 ? text.slice(0, 120).trimEnd() + "…" : text
    return { ...page, words, excerpt }
  })

  const totalWords = pages.reduce((sum, p) => sum + p.words, 0)

  return (
    <div className="space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight">Grammar</h1>
        {pages.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {pages.length} page{pages.length !== 1 ? "s" : ""}
            {totalWords > 0 && ` · ${totalWords.toLocaleString()} words`}
          </p>
        )}
      </div>

      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-medium mb-2">No grammar pages yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            The author hasn&apos;t added any grammar documentation yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pages.map((page, index) => (
            <Link
              key={page.id}
              href={`/lang/${language.slug}/grammar/${page.slug}`}
              className="group flex items-start gap-4 rounded-xl border border-border/40 bg-card/30 p-5 transition-all hover:border-primary/30 hover:bg-card/60 hover:shadow-sm"
            >
              {/* Ordinal */}
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground/50 font-mono mt-0.5 w-5 text-right">
                {index + 1}.
              </span>

              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-lg font-medium group-hover:text-primary transition-colors">
                  {page.title}
                </h2>
                {page.excerpt && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {page.excerpt}
                  </p>
                )}
                {page.words > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground/60 tabular-nums">
                    {page.words.toLocaleString()} word{page.words !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground/30 mt-1 group-hover:text-primary/50 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
