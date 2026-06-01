import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Blocks, Search, ChevronLeft, ChevronRight, BookOpen, FlaskConical } from "lucide-react"
import { ModuleCard } from "@/components/modules/module-card"
import { MODULE_TYPES } from "@/lib/modules/types"
import { listPublishedModules, type ModuleSort } from "@/lib/services/module"
import type { ModuleType } from "@prisma/client"
import { getSiteUrl } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Modules — Extend LingoCon",
  description:
    "Browse community-built modules for LingoCon: studio tools, reader widgets, generators, exporters, and themes. Add any module to your language in one click.",
  alternates: { canonical: `${getSiteUrl()}/modules` },
}

export const dynamic = "force-dynamic"

const SORTS: { value: ModuleSort; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "recent", label: "Recent" },
  { value: "rating", label: "Top rated" },
  { value: "name", label: "Name" },
]

function isModuleType(v: string | undefined): v is ModuleType {
  return !!v && MODULE_TYPES.some((m) => m.type === v)
}

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; sort?: string; page?: string }>
}) {
  const [session, params] = await Promise.all([auth(), searchParams])

  const type = isModuleType(params.type) ? params.type : undefined
  const query = params.q || ""
  const sort = (SORTS.find((s) => s.value === params.sort)?.value ?? "popular") as ModuleSort
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)

  const { modules, total, totalPages } = await listPublishedModules({ type, query, sort, page })

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user
    ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} isDevMode={isDevMode} />
      <div className="h-14" />

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 border-b border-border/40 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 font-serif text-4xl tracking-tight md:text-5xl">Modules</h1>
            <p className="text-muted-foreground">
              Extend your languages with community-built tools — add any of {total} module
              {total === 1 ? "" : "s"} in one click.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/modules/docs">
              <Button variant="ghost">
                <BookOpen className="mr-2 h-4 w-4" />
                Docs
              </Button>
            </Link>
            <Link href="/dashboard/modules/playground">
              <Button variant="ghost">
                <FlaskConical className="mr-2 h-4 w-4" />
                Playground
              </Button>
            </Link>
            <Link href="/dashboard/modules">
              <Button variant="outline">
                <Blocks className="mr-2 h-4 w-4" />
                Build a module
              </Button>
            </Link>
          </div>
        </div>

        {/* Search + sort */}
        <form action="/modules" className="mb-6 flex flex-col gap-3 sm:flex-row">
          {type && <input type="hidden" name="type" value={type} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={query} placeholder="Search modules…" className="pl-9" />
          </div>
          <div className="flex gap-2">
            {SORTS.map((s) => (
              <Link key={s.value} href={`/modules${buildQuery({ type, q: query, sort: s.value })}`}>
                <Button type="button" variant={sort === s.value ? "default" : "outline"} size="sm">
                  {s.label}
                </Button>
              </Link>
            ))}
          </div>
        </form>

        {/* Type filter chips */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link href={`/modules${buildQuery({ q: query, sort })}`}>
            <Badge variant={!type ? "default" : "outline"} className="cursor-pointer px-3 py-1">
              All
            </Badge>
          </Link>
          {MODULE_TYPES.map((m) => (
            <Link key={m.type} href={`/modules${buildQuery({ type: m.type, q: query, sort })}`}>
              <Badge
                variant={type === m.type ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
              >
                {m.label}
                {m.priority ? " ★" : ""}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Grid */}
        {modules.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Blocks className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="font-serif text-lg">No modules yet</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-sm">
                {query || type
                  ? "Nothing matches your filters yet."
                  : "Be the first to publish a module for the community."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <ModuleCard key={m.slug} module={m} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <Link href={`/modules${buildQuery({ type, q: query, sort, page: String(page - 1) })}`}>
              <Button variant="outline" size="sm" disabled={page <= 1}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
            </Link>
            <span className="mx-4 text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Link href={`/modules${buildQuery({ type, q: query, sort, page: String(page + 1) })}`}>
              <Button variant="outline" size="sm" disabled={page >= totalPages}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
