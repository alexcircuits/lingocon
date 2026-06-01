"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { cn } from "@/lib/utils"
import { ExternalLink, Menu } from "lucide-react"
import type { Language } from "@prisma/client"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { StudioSidebar, StudioNavContent } from "@/components/studio-sidebar"
import { STUDIO_TABS, tabHref, isTabActive, getActiveTab, type ModuleNavTab } from "@/lib/studio-nav"
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
  /** Studio-panel tabs contributed by the user's enabled modules. */
  moduleTabs?: ModuleNavTab[]
  children: React.ReactNode
}

export function StudioLayout({ language, moduleTabs = [], children }: StudioLayoutProps) {
  const pathname = usePathname()
  const basePath = `/studio/lang/${language.slug}`
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeTab = getActiveTab(pathname, basePath)
  const activeModuleTab = moduleTabs.find((t) => pathname === t.href)
  const activeName = activeModuleTab?.name ?? activeTab?.name
  const primaryTabs = STUDIO_TABS.filter((t) => t.primary)

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="container-fluid mx-auto flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            {/* Mobile Menu Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2 shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0 pt-10">
                <StudioNavContent
                  language={language}
                  basePath={basePath}
                  moduleTabs={moduleTabs}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {/* Current section (mobile) */}
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <span className="truncate text-sm font-semibold">{language.name}</span>
              {activeName && pathname !== basePath && (
                <>
                  <span className="shrink-0 text-muted-foreground/50">/</span>
                  <span className="truncate text-sm text-muted-foreground">{activeName}</span>
                </>
              )}
            </div>

            {/* Breadcrumbs */}
            <Breadcrumbs
              items={[
                { label: "Dashboard", href: "/dashboard" },
                { label: language.name, href: basePath },
                ...(pathname !== basePath
                  ? [{ label: activeModuleTab?.name ?? activeTab?.name ?? "Page" }]
                  : []),
              ]}
              className="hidden md:flex"
            />
          </div>

          <Link href={`/lang/${language.slug}`} target="_blank" className="shrink-0">
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
        <StudioSidebar language={language} basePath={basePath} moduleTabs={moduleTabs} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background relative scroll-smooth thin-scrollbar">
          <div className="container mx-auto p-4 md:p-8 max-w-6xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation (in-flow so it always pins to the bottom) */}
      <nav className="z-40 flex shrink-0 items-stretch border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
        {primaryTabs.map((tab) => {
          const href = tabHref(basePath, tab.segment)
          const active = isTabActive(pathname, basePath, tab.segment)
          const Icon = tab.icon
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{tab.name}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}
