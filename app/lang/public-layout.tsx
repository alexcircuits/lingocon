"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Languages,
  BookOpen,
  FileText,
  LayoutDashboard,
  Newspaper,
  BookMarked,
  Table2
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Footer } from "@/components/footer"

interface Language {
  id: string
  name: string
  slug: string
  visibility: string
}

interface PublicLayoutProps {
  language: Language
  children: React.ReactNode
  user?: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
  isDevMode?: boolean
}

export function PublicLayout({ language, children, user, isDevMode }: PublicLayoutProps) {
  const pathname = usePathname()
  const basePath = `/lang/${language.slug}`

  const navItems = [
    { name: "Overview", href: basePath, icon: LayoutDashboard },
    { name: "Alphabet", href: `${basePath}/alphabet`, icon: Languages },
    { name: "Grammar", href: `${basePath}/grammar`, icon: BookOpen },
    { name: "Dictionary", href: `${basePath}/dictionary`, icon: FileText },
    { name: "Paradigms", href: `${basePath}/paradigms`, icon: Table2 },
    { name: "Articles", href: `${basePath}/articles`, icon: Newspaper },
    { name: "Texts", href: `${basePath}/texts`, icon: BookMarked },
  ]

  const breadcrumbItems = [
    { label: "Browse", href: "/browse" },
    { label: language.name },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Global Navbar */}
      <Navbar user={user} isDevMode={isDevMode} />

      {/* Spacer for fixed navbar */}
      <div className="h-14" />

      {/* Breadcrumbs */}
      <div className="border-b border-border/40 bg-secondary/20">
        <div className="container mx-auto px-4 py-2">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      {/* Language Sub-Navigation */}
      <nav className="border-b border-border/40 bg-background sticky top-14 z-30">
        <div className="container mx-auto px-4">
          <ul className="flex gap-0.5 overflow-x-auto scrollbar-hide -mb-px">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== basePath && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto py-8 px-4">{children}</div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
