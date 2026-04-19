import Link from "next/link"
import type { Metadata } from "next"
import { DOC_PAGES } from "@/lib/docs/site-docs"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com"

export const metadata: Metadata = {
  title: "Overview",
  description: "Contributor documentation index: architecture, codebase, database, development, and API patterns.",
  alternates: {
    canonical: `${siteUrl}/docs`,
  },
}

export default function DocsIndexPage() {
  return (
    <div>
      <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
        Living docs
      </Badge>
      <h2 className="font-serif text-2xl font-medium md:text-3xl">Start here</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        These pages track the markdown in the repository. When a guide is updated on{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">main</code>, redeploy the site to refresh
        what you see here.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {DOC_PAGES.map((page) => (
          <li key={page.slug}>
            <Link
              href={`/docs/${page.slug}`}
              className="group flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <span className="font-serif text-lg font-medium group-hover:text-primary">
                {page.title}
              </span>
              <span className="mt-2 flex-1 text-sm text-muted-foreground">{page.description}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Read guide
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
