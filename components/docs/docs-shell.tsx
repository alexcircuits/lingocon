"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { DOC_PAGES } from "@/lib/docs/site-docs"
import { BookOpen, FileText, Github, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const SOURCE_TREE = "https://github.com/alexcircuits/lingocon/tree/main/docs"

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isOverview = pathname === "/docs"

  return (
    <div className="border-b border-border/40 bg-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Contributors
            </p>
            <h1 className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
              Developer documentation
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Same guides as in the{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">docs/</code> folder on GitHub,
              rendered here so you can read them without leaving the site.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href="/contributions">
                <ArrowLeft className="h-4 w-4" />
                Contributions hub
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={SOURCE_TREE} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                Edit on GitHub
              </a>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <nav className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                On this site
              </p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/docs"
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isOverview
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    Overview
                  </Link>
                </li>
                {DOC_PAGES.map((page) => {
                  const href = `/docs/${page.slug}`
                  const active = pathname === href
                  return (
                    <li key={page.slug}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate">{page.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
