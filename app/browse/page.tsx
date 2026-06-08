import type { Metadata } from "next"
import { auth } from "@/auth"
import { getSiteUrl } from "@/lib/seo"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Globe, ChevronLeft, ChevronRight } from "lucide-react"
import { BrowseResults } from "./components/browse-results"
import { SortSelector } from "./components/sort-selector"
import { BrowseSearch } from "./components/browse-search"
import { CategoryFilter, CATEGORY_FILTER_VALUES, type CategoryFilter as CategoryFilterValue } from "./components/category-filter"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.browse")
  return {
    title: t("title"),
    description: t("description"),
    keywords: ["browse conlangs", "conlang list", "constructed languages", "conlang examples", "conlang community", "invented languages", "fictional languages"],
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
    },
    alternates: {
      canonical: `${getSiteUrl()}/browse`,
    },
  }
}

export const dynamic = "force-dynamic"

type SortOption = "recent" | "updated" | "entries" | "name" | "likes"

const CATEGORY_VALUES = new Set<CategoryFilterValue>(CATEGORY_FILTER_VALUES)

function parseCategory(raw: string | undefined): CategoryFilterValue {
  if (!raw) return "all"
  return CATEGORY_VALUES.has(raw as CategoryFilterValue) ? (raw as CategoryFilterValue) : "all"
}

/** A sliding window of page numbers centered on the current page. */
function pageWindow(current: number, total: number, size = 5): number[] {
  const half = Math.floor(size / 2)
  let start = Math.max(1, current - half)
  const end = Math.min(total, start + size - 1)
  start = Math.max(1, end - size + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

async function getPublicLanguages(
  sortBy: SortOption = "recent",
  page: number = 1,
  query: string = "",
  category: CategoryFilterValue = "all",
) {
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const searchClause = query
    ? { OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { description: { contains: query, mode: "insensitive" as const } },
      ] }
    : {}

  const categoryClause = category !== "all" ? { category } : {}

  const where = { visibility: "PUBLIC" as const, ...searchClause, ...categoryClause }

  const sharedSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    flagUrl: true,
    fontUrl: true,
    fontFamily: true,
    fontScale: true,
    createdAt: true,
    updatedAt: true,
    visibility: true,
    category: true,
    metadata: true,
    discordUrl: true,
    telegramUrl: true,
    websiteUrl: true,
    ownerId: true,
    allowsDiacritics: true,
    allowForking: true,
    parentLanguageId: true,
    externalAncestry: true,
    familyId: true,
    owner: {
      select: { id: true, name: true, image: true },
    },
    _count: {
      select: {
        scriptSymbols: true,
        grammarPages: true,
        dictionaryEntries: true,
        favorites: true,
        courses: { where: { visibility: "PUBLISHED" as const } },
      },
    },
  } as const

  let languages
  let total = await prisma.language.count({ where })

  if (sortBy === "entries") {
    // Use Prisma's relation-count ordering — no in-memory sort needed.
    languages = await prisma.language.findMany({
      where,
      select: sharedSelect,
      orderBy: { dictionaryEntries: { _count: "desc" } },
      take: pageSize,
      skip,
    })
  } else if (sortBy === "likes") {
    languages = await prisma.language.findMany({
      where,
      select: sharedSelect,
      orderBy: { favorites: { _count: "desc" } },
      take: pageSize,
      skip,
    })
  } else {
    let orderBy: Record<string, "asc" | "desc"> = {}
    switch (sortBy) {
      case "recent":
        orderBy = { createdAt: "desc" }
        break
      case "updated":
        orderBy = { updatedAt: "desc" }
        break
      case "name":
        orderBy = { name: "asc" }
        break
    }

    languages = await prisma.language.findMany({
      where,
      select: sharedSelect,
      orderBy,
      take: pageSize,
      skip,
    })
  }

  return {
    languages,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  }
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string; q?: string; category?: string }>
}) {
  const [session, params] = await Promise.all([
    auth(),
    searchParams,
  ])

  const sortBy = (params.sort as SortOption) || "recent"
  const page = parseInt(params.page || "1", 10)
  const query = params.q || ""
  const category = parseCategory(params.category)
  const { languages, total, totalPages } = await getPublicLanguages(sortBy, page, query, category)

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  const t = await getTranslations("browse")

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} isDevMode={isDevMode} />

      <div className="h-14" />

      <main className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Page header */}
        <div className="mb-10 pb-6 border-b border-border/40">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-2">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">
            {t("discoverCount", { count: total })}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="mb-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-auto">
            <BrowseSearch />
          </div>
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <span className="text-sm text-muted-foreground">
              {t("countOfTotal", { shown: languages.length, total })}
            </span>
            <CategoryFilter currentCategory={category} />
            <SortSelector currentSort={sortBy} />
          </div>
        </div>

        {/* Languages Grid */}
        {languages.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="text-center py-16">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg font-serif">{t("emptyTitle")}</CardTitle>
              <CardDescription className="max-w-sm mx-auto mt-2">
                {query ? t("emptySearchHint") : t("emptyFirstHint")}
              </CardDescription>
            </CardHeader>
            {!query && (
              <CardContent className="flex justify-center pb-16">
                <Link href="/dashboard/new-language">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("createLanguage")}
                  </Button>
                </Link>
              </CardContent>
            )}
          </Card>
        ) : (
          <>
            <BrowseResults languages={languages} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2">
                {page > 1 ? (
                  <Link href={`/browse?sort=${sortBy}&page=${page - 1}${query ? `&q=${query}` : ""}${category !== "all" ? `&category=${category}` : ""}`}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("previous")}
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t("previous")}
                  </Button>
                )}

                <div className="flex items-center gap-1 mx-4">
                  {pageWindow(page, totalPages).map((pageNum) => (
                    <Link key={pageNum} href={`/browse?sort=${sortBy}&page=${pageNum}${query ? `&q=${query}` : ""}${category !== "all" ? `&category=${category}` : ""}`}>
                      <Button
                        variant={page === pageNum ? "default" : "ghost"}
                        size="sm"
                        className={page === pageNum ? "" : "text-muted-foreground"}
                      >
                        {pageNum}
                      </Button>
                    </Link>
                  ))}
                  {pageWindow(page, totalPages).at(-1)! < totalPages && (
                    <span className="text-muted-foreground px-2">...</span>
                  )}
                </div>

                {page < totalPages ? (
                  <Link href={`/browse?sort=${sortBy}&page=${page + 1}${query ? `&q=${query}` : ""}${category !== "all" ? `&category=${category}` : ""}`}>
                    <Button variant="outline" size="sm">
                      {t("next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    {t("next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

