import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { GrammarContent } from "@/components/grammar-content"
import { GrammarSidebar } from "@/components/grammar-sidebar"
import { Card } from "@/components/ui/card"

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

          <div className="prose prose-slate dark:prose-invert max-w-none 
            prose-headings:font-serif prose-headings:font-medium
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl">
            <GrammarContent content={page.content} />
          </div>
        </div>
      </div>
    </div>
  )
}

