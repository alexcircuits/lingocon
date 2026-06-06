"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, Menu, Search, X } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState, useEffect, useTransition } from "react"
import { searchGrammarPages, type GrammarSearchResult } from "@/app/actions/search-grammar"

interface GrammarSidebarProps {
  languageSlug: string
  pages: {
    id: string
    title: string
    slug: string
    order: number
  }[]
  currentSlug: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function GrammarSidebar({ languageSlug, pages, currentSlug }: GrammarSidebarProps) {
  const t = useTranslations("studio.grammar")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GrammarSearchResult[]>([])
  const [isPending, startTransition] = useTransition()
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    startTransition(async () => {
      const data = await searchGrammarPages(languageSlug, debouncedQuery)
      setResults(data)
    })
  }, [debouncedQuery, languageSlug])

  const isSearching = query.trim().length > 0

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-1 py-2">
      {isSearching ? (
        results.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground italic">
            {isPending ? t("searching") : t("noResults")}
          </p>
        ) : (
          results.map((r) => (
            <Link
              key={r.id}
              href={`/lang/${languageSlug}/grammar/${r.slug}`}
              onClick={onNavigate}
              className={cn(
                "block px-4 py-2 text-sm transition-colors hover:bg-muted rounded-md mx-2",
                currentSlug === r.slug
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-medium block">{r.title}</span>
              {r.excerpt && (
                <span className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {r.excerpt}
                </span>
              )}
            </Link>
          ))
        )
      ) : pages.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground italic">{t("noPages")}</p>
      ) : (
        pages.map((page) => (
          <Link
            key={page.id}
            href={`/lang/${languageSlug}/grammar/${page.slug}`}
            onClick={onNavigate}
            className={cn(
              "block px-4 py-2 text-sm font-medium transition-colors hover:bg-muted rounded-md mx-2",
              currentSlug === page.slug
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {page.title}
          </Link>
        ))
      )}
    </div>
  )

  const SearchBar = () => (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPages")}
        className="h-8 pl-8 pr-8 text-sm"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile Trigger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="lg:hidden mb-4 gap-2">
            <Menu className="h-4 w-4" />
            Grammar Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <div className="p-4 border-b space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Grammar
            </h2>
            <SearchBar />
          </div>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <NavList onNavigate={() => setOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r min-h-[calc(100vh-3.5rem)] bg-muted/10">
        <div className="sticky top-20">
          <div className="p-4 border-b border-border/40 mb-2 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Table of Contents
            </h2>
            <SearchBar />
          </div>
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <NavList />
          </ScrollArea>
        </div>
      </aside>
    </>
  )
}
