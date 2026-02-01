import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Globe, ChevronLeft, ChevronRight } from "lucide-react"
import { BookCard } from "@/components/landing/book-card"
import { SortSelector } from "./components/sort-selector"
import { BrowseSearch } from "./components/browse-search"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Browse Languages",
  description: "Explore public constructed languages created by the LingoCon community. Discover new conlangs, lexicons, and grammar documentation.",
}

export const dynamic = "force-dynamic"

type SortOption = "recent" | "updated" | "entries" | "name"

async function getPublicLanguages(sortBy: SortOption = "recent", page: number = 1, query: string = "") {
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const where: any = {
    visibility: "PUBLIC",
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ]
  }

  let languages
  let total = await prisma.language.count({
    where,
  })

  if (sortBy === "entries") {
    const allLanguages = await prisma.language.findMany({
      where,
      select: {
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
        metadata: true,
        discordUrl: true,
        telegramUrl: true,
        websiteUrl: true,
        ownerId: true,
        allowsDiacritics: true,
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            scriptSymbols: true,
            grammarPages: true,
            dictionaryEntries: true,
            favorites: true,
          },
        },
      },
    })

    allLanguages.sort(
      (a, b) => b._count.dictionaryEntries - a._count.dictionaryEntries
    )

    languages = allLanguages.slice(skip, skip + pageSize)
  } else {
    let orderBy: any = {}
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
      select: {
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
        metadata: true,
        discordUrl: true,
        telegramUrl: true,
        websiteUrl: true,
        ownerId: true,
        allowsDiacritics: true,
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            scriptSymbols: true,
            grammarPages: true,
            dictionaryEntries: true,
            favorites: true,
          },
        },
      },
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
  searchParams: Promise<{ sort?: string; page?: string; q?: string }>
}) {
  const [session, params] = await Promise.all([
    auth(),
    searchParams,
  ])

  const sortBy = (params.sort as SortOption) || "recent"
  const page = parseInt(params.page || "1", 10)
  const query = params.q || ""
  const { languages, total, totalPages } = await getPublicLanguages(sortBy, page, query)

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} isDevMode={isDevMode} />

      <div className="h-14" />

      <main className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Page header */}
        <div className="mb-10 pb-6 border-b border-border/40">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-2">Browse</h1>
          <p className="text-muted-foreground">
            Discover {total} public constructed {total === 1 ? 'language' : 'languages'}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="mb-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-auto">
            <BrowseSearch />
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <span className="text-sm text-muted-foreground">
              {languages.length} of {total}
            </span>
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
              <CardTitle className="text-lg font-serif">No languages found</CardTitle>
              <CardDescription className="max-w-sm mx-auto mt-2">
                {query ? "Try a different search term" : "Be the first to create and share a constructed language!"}
              </CardDescription>
            </CardHeader>
            {!query && (
              <CardContent className="flex justify-center pb-16">
                <Link href="/dashboard/new-language">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Language
                  </Button>
                </Link>
              </CardContent>
            )}
          </Card>
        ) : (
          <>
            <div className="grid gap-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {languages.map((language) => (
                <BookCard key={language.id} language={language} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2">
                {page > 1 ? (
                  <Link href={`/browse?sort=${sortBy}&page=${page - 1}${query ? `&q=${query}` : ""}`}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                )}

                <div className="flex items-center gap-1 mx-4">
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const pageNum = i + 1
                    return (
                      <Link key={pageNum} href={`/browse?sort=${sortBy}&page=${pageNum}${query ? `&q=${query}` : ""}`}>
                        <Button
                          variant={page === pageNum ? "default" : "ghost"}
                          size="sm"
                          className={page === pageNum ? "" : "text-muted-foreground"}
                        >
                          {pageNum}
                        </Button>
                      </Link>
                    )
                  })}
                  {totalPages > 5 && (
                    <span className="text-muted-foreground px-2">...</span>
                  )}
                </div>

                {page < totalPages ? (
                  <Link href={`/browse?sort=${sortBy}&page=${page + 1}${query ? `&q=${query}` : ""}`}>
                    <Button variant="outline" size="sm">
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
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

