"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

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

export function GrammarSidebar({ languageSlug, pages, currentSlug }: GrammarSidebarProps) {
  const [open, setOpen] = useState(false)

  const NavList = () => (
    <div className="space-y-1 py-2">
      {pages.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground italic">No pages yet</p>
      ) : (
        pages.map((page) => (
          <Link
            key={page.id}
            href={`/lang/${languageSlug}/grammar/${page.slug}`}
            onClick={() => setOpen(false)}
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
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Grammar
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
              <BookOpen className="h-4 w-4" />
              Table of Contents
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

