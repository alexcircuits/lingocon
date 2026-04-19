import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { DocMarkdown } from "@/components/docs/doc-markdown"
import { loadDocMarkdown } from "@/lib/docs/load-doc"
import { DOC_PAGES, getDocPage, isDocSlug } from "@/lib/docs/site-docs"
import type { DocSlug } from "@/lib/docs/site-docs"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com"

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }))
}

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  if (!isDocSlug(slug)) {
    return { title: "Not found" }
  }
  const page = getDocPage(slug)
  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `${siteUrl}/docs/${slug}`,
    },
    openGraph: {
      title: `${page.title} | LingoCon docs`,
      description: page.description,
      url: `${siteUrl}/docs/${slug}`,
    },
  }
}

export default async function DocSlugPage({ params }: PageProps) {
  const { slug } = await params
  if (!isDocSlug(slug)) {
    notFound()
  }

  const markdown = await loadDocMarkdown(slug as DocSlug)

  return (
    <article className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 shadow-sm sm:px-8 md:py-10">
      <div
        className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-primary prose-code:text-sm prose-pre:bg-muted/80"
      >
        <DocMarkdown content={markdown} />
      </div>
    </article>
  )
}
