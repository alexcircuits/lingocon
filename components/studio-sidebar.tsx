"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
  Clock,
  AudioWaveform,
} from "lucide-react"
import { formatDate } from "@/lib/utils"

interface StudioSidebarProps {
  language: {
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
  basePath: string
}

export function StudioSidebar({ language, basePath }: StudioSidebarProps) {
  const pathname = usePathname()

  const tabs = [
    { name: "Overview", href: basePath, icon: LayoutDashboard, color: "text-primary" },
    { name: "Alphabet", href: `${basePath}/alphabet`, icon: Languages, color: "text-blue-500" },
    { name: "Phonology", href: `${basePath}/phonology`, icon: AudioWaveform, color: "text-cyan-500" },
    { name: "Grammar", href: `${basePath}/grammar`, icon: BookOpen, color: "text-violet-500" },
    { name: "Dictionary", href: `${basePath}/dictionary`, icon: FileText, color: "text-emerald-500" },
    { name: "Paradigms", href: `${basePath}/paradigms`, icon: Table2, color: "text-rose-500" },
    { name: "Articles", href: `${basePath}/articles`, icon: Newspaper, color: "text-amber-500" },
    { name: "Texts", href: `${basePath}/texts`, icon: BookMarked, color: "text-indigo-500" },
    { name: "Settings", href: `${basePath}/settings`, icon: Settings, color: "text-muted-foreground" },
  ]

  const stats = language._count ? [
    { label: "Entries", value: language._count.dictionaryEntries, icon: FileText, color: "emerald" },
    { label: "Pages", value: language._count.grammarPages, icon: BookOpen, color: "violet" },
    { label: "Symbols", value: language._count.scriptSymbols, icon: Languages, color: "blue" },
    { label: "Paradigms", value: language._count.paradigms, icon: Table2, color: "rose" },
  ] : []

  return (
    <aside className="hidden md:block w-64 shrink-0 border-r border-border/40 bg-card/30 backdrop-blur-sm overflow-y-auto thin-scrollbar">
      {/* Language Info */}
      <div className="p-4 border-b border-border/40">
        <h3 className="font-serif text-lg font-medium mb-1 truncate">{language.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {formatDate(language.updatedAt)}</span>
        </div>
      </div>

      {/* Quick Stats */}
      {stats.length > 0 && (
        <div className="p-4 border-b border-border/40">
          <div className="grid grid-cols-2 gap-2">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.label} className="p-2 border-border/50 bg-card/50">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-md",
                        stat.color === "emerald" && "bg-emerald-500/10",
                        stat.color === "violet" && "bg-violet-500/10",
                        stat.color === "blue" && "bg-blue-500/10",
                        stat.color === "rose" && "bg-rose-500/10",
                      )}>
                        <Icon className={cn(
                          "h-3.5 w-3.5",
                          stat.color === "emerald" && "text-emerald-500",
                          stat.color === "violet" && "text-violet-500",
                          stat.color === "blue" && "text-blue-500",
                          stat.color === "rose" && "text-rose-500",
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
                        <div className="text-sm font-semibold">{stat.value}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        <div className="mb-2 px-3 py-1.5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Navigation
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
    </aside>
  )
}


