"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Languages,
  BookOpen,
  FileText,
  Table2,
  Newspaper,
  BookMarked,
  Settings,
  ExternalLink,
  ChevronRight,
  Menu
} from "lucide-react"
import type { Language } from "@prisma/client"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { StudioSidebar } from "@/components/studio-sidebar"
import { useState } from "react"

interface StudioLayoutProps {
  language: Language & {
    owner: {
      id: string
      name: string | null
      email: string | null
    }
    _count?: {
      scriptSymbols: number
      grammarPages: number
      dictionaryEntries: number
      paradigms: number
      articles?: number
      texts?: number
    }
  }
  children: React.ReactNode
}

export function StudioLayout({ language, children }: StudioLayoutProps) {
  const pathname = usePathname()
  const basePath = `/studio/lang/${language.slug}`
  const [mobileOpen, setMobileOpen] = useState(false)

  const tabs = [
    { name: "Overview", href: basePath, icon: LayoutDashboard },
    { name: "Alphabet", href: `${basePath}/alphabet`, icon: Languages },
    { name: "Grammar", href: `${basePath}/grammar`, icon: BookOpen },
    { name: "Dictionary", href: `${basePath}/dictionary`, icon: FileText },
    { name: "Paradigms", href: `${basePath}/paradigms`, icon: Table2 },
    { name: "Articles", href: `${basePath}/articles`, icon: Newspaper },
    { name: "Texts", href: `${basePath}/texts`, icon: BookMarked },
    { name: "Settings", href: `${basePath}/settings`, icon: Settings },
  ]

  const NavContent = () => (
    <nav className="p-3 space-y-1">
      <div className="mb-4 px-3 py-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Studio
        </h2>
      </div>
      <ul className="space-y-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href ||
            (tab.href !== basePath && pathname.startsWith(tab.href))
          const Icon = tab.icon
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {tab.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="container-fluid mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile Menu Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 pt-10">
                <NavContent />
              </SheetContent>
            </Sheet>

            {/* Breadcrumbs */}
            <Breadcrumbs
              items={[
                { label: "Dashboard", href: "/dashboard" },
                { label: language.name, href: basePath },
                ...(pathname !== basePath ? [{
                  label: tabs.find(t => pathname.startsWith(t.href) && t.href !== basePath)?.name || "Page"
                }] : [])
              ]}
              className="hidden md:flex"
            />
          </div>

          <Link href={`/lang/${language.slug}`} target="_blank">
            <Button variant="outline" size="sm" className="h-8 border-border/60 bg-background/50 hover:bg-background hover:shadow-sm transition-all">
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              <span className="hidden sm:inline">View Public</span>
              <span className="sm:hidden">View</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <StudioSidebar language={language} basePath={basePath} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background relative scroll-smooth thin-scrollbar">
          <div className="container mx-auto p-4 md:p-8 max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

