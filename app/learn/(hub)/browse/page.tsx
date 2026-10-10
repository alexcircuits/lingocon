import type { Metadata } from "next"
import Link from "next/link"
import { getSiteUrl } from "@/lib/seo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GraduationCap, Search, ChevronLeft, ChevronRight, Globe } from "lucide-react"
import { getLearnableLanguages, countLearnableLanguages } from "@/lib/learn-catalog"
import { LearnLanguageCard } from "../components/learn-language-card"

export const metadata: Metadata = {
  title: "Learn a Language — Course Catalog | LingoCon",
  description:
    "Browse constructed languages you can learn on LingoCon. Enroll in community-built courses with lessons, spaced-repetition review, XP, and streaks.",
  keywords: ["learn conlang", "conlang courses", "constructed language lessons", "learn a constructed language"],
  alternates: { canonical: `${getSiteUrl()}/learn/browse` },
  openGraph: {
    title: "Learn a Language — Course Catalog | LingoCon",
    description: "Browse constructed languages you can learn, with lessons, spaced-repetition review, XP, and streaks.",
    type: "website",
  },
}

export const dynamic = "force-dynamic"

const PAGE_SIZE = 24

function pageWindow(current: number, total: number, size = 5): number[] {
  const half = Math.floor(size / 2)
  let start = Math.max(1, current - half)
  const end = Math.min(total, start + size - 1)
  start = Math.max(1, end - size + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export default async function LearnBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = params.q?.trim() || ""
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)

  const [languages, total] = await Promise.all([
    getLearnableLanguages({ search: query, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    countLearnableLanguages(query),
  ])
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const hrefFor = (p: number) => `/learn/browse?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${p}`

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <GraduationCap className="h-6 w-6" />
          <span className="text-sm font-medium">Course Catalog</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Learn a language</h1>
        <p className="mt-2 text-muted-foreground">
          {total} constructed {total === 1 ? "language" : "languages"} ready to learn — pick one and start a course.
        </p>
      </div>

      {/* Search */}
      <form action="/learn/browse" method="GET" className="mb-8 flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search learnable languages..."
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Results */}
      {languages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Globe className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">
            {query ? "No courses match your search" : "No courses yet"}
          </h2>
          <p className="mb-6 max-w-sm text-muted-foreground">
            {query
              ? "Try a different search term, or browse all public languages."
              : "Be the first to publish a course — open any language you own in the studio and create one."}
          </p>
          <Button asChild variant="outline">
            <Link href="/browse">Browse all languages</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {languages.map((language) => (
              <LearnLanguageCard key={language.id} language={language} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
                {page > 1 ? (
                  <Link href={hrefFor(page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </span>
                )}
              </Button>

              <div className="mx-4 flex items-center gap-1">
                {pageWindow(page, totalPages).map((p) => (
                  <Button
                    key={p}
                    asChild={p !== page}
                    variant={p === page ? "default" : "ghost"}
                    size="sm"
                    className={p === page ? "" : "text-muted-foreground"}
                  >
                    {p === page ? <span>{p}</span> : <Link href={hrefFor(p)}>{p}</Link>}
                  </Button>
                ))}
              </div>

              <Button asChild={page < totalPages} variant="outline" size="sm" disabled={page >= totalPages}>
                {page < totalPages ? (
                  <Link href={hrefFor(page + 1)}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                ) : (
                  <span>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
