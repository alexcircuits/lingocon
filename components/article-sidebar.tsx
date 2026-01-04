"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

interface ArticleSidebarProps {
  languageSlug: string
  articles: {
    id: string
    title: string
    slug: string
  }[]
  currentSlug: string
}

export function ArticleSidebar({ languageSlug, articles, currentSlug }: ArticleSidebarProps) {
  const [open, setOpen] = useState(false)

  const NavList = () => (
    <div className="space-y-1 py-2">
      {articles.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground italic">No articles yet</p>
      ) : (
        articles.map((article) => (
          <Link
            key={article.id}
            href={`/lang/${languageSlug}/articles/${article.slug}`}
            onClick={() => setOpen(false)}
            className={cn(
              "block px-4 py-2 text-sm font-medium transition-colors hover:bg-muted rounded-md mx-2",
              currentSlug === article.slug
                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/15"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {article.title}
          </Link>
        ))
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
            Article Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Articles
            </h2>
          </div>
          <ScrollArea className="h-[calc(100vh-65px)]">
            <NavList />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r min-h-[calc(100vh-3.5rem)] bg-muted/10">
        <div className="sticky top-20">
          <div className="p-4 border-b border-border/40 mb-2">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Articles
            </h2>
          </div>
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <NavList />
          </ScrollArea>
        </div>
      </aside>
    </>
  )
}

