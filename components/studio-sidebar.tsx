"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BookOpen, FileText, Table2, Languages, Clock } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { STUDIO_TABS, tabHref, isTabActive, type ModuleNavTab } from "@/lib/studio-nav"
import { ModuleIcon } from "@/components/modules/module-icon"

interface StudioLanguage {
  id: string
  name: string
  slug: string
  updatedAt: Date
  _count?: {
    scriptSymbols: number
    grammarPages: number
    dictionaryEntries: number
    paradigms: number
    articles?: number
    texts?: number
  }
}

/**
 * Shared inner navigation used by both the desktop sidebar and the mobile
 * drawer. `onNavigate` lets the mobile drawer close on selection.
 */
export function StudioNavContent({
  language,
  basePath,
  moduleTabs = [],
  onNavigate,
}: {
  language: StudioLanguage
  basePath: string
  moduleTabs?: ModuleNavTab[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  const stats = language._count
    ? [
        { label: "Entries", value: language._count.dictionaryEntries, icon: FileText },
        { label: "Pages", value: language._count.grammarPages, icon: BookOpen },
        { label: "Symbols", value: language._count.scriptSymbols, icon: Languages },
        { label: "Paradigms", value: language._count.paradigms, icon: Table2 },
      ]
    : []

  return (
    <div className="flex h-full flex-col">
      {/* Language Info */}
      <div className="border-b border-border/40 p-4">
        <h3 className="mb-1 truncate text-lg font-bold tracking-tight">{language.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {formatDate(language.updatedAt)}</span>
        </div>
      </div>

      {/* Quick Stats */}
      {stats.length > 0 && (
        <div className="border-b border-border/40 p-4">
          <div className="flex flex-wrap gap-1.5">
            {stats.map((stat) => (
              <span
                key={stat.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-2.5 py-1 text-xs"
              >
                <span className="font-semibold tabular-nums">{stat.value}</span>
                <span className="text-muted-foreground">{stat.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 thin-scrollbar">
        <div className="mb-2 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navigation</h2>
        </div>
        <ul className="space-y-1">
          {STUDIO_TABS.map((tab) => {
            const href = tabHref(basePath, tab.segment)
            const active = isTabActive(pathname, basePath, tab.segment)
            const Icon = tab.icon
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all sm:py-2",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  {tab.name}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Module-contributed panels */}
        {moduleTabs.length > 0 && (
          <>
            <div className="mb-2 mt-4 px-3 py-1.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modules</h2>
            </div>
            <ul className="space-y-1">
              {moduleTabs.map((tab) => {
                const active = pathname === tab.href
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all sm:py-2",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <ModuleIcon
                        name={tab.icon}
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      <span className="truncate">{tab.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </nav>
    </div>
  )
}

export function StudioSidebar({
  language,
  basePath,
  moduleTabs = [],
}: {
  language: StudioLanguage
  basePath: string
  moduleTabs?: ModuleNavTab[]
}) {
  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border/40 bg-card/30 backdrop-blur-sm thin-scrollbar md:block">
      <StudioNavContent language={language} basePath={basePath} moduleTabs={moduleTabs} />
    </aside>
  )
}
