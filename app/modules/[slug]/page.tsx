import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserId } from "@/lib/auth-helpers"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BadgeCheck, Star, Download, Github, ExternalLink, ShieldCheck } from "lucide-react"
import { DocMarkdown } from "@/components/docs/doc-markdown"
import { ModuleIcon } from "@/components/modules/module-icon"
import { AddModuleButton } from "@/components/modules/add-module-button"
import { ReportModuleButton } from "@/components/modules/report-module-button"
import { getModuleBySlug, getInstallState } from "@/lib/services/module"
import { getModuleTypeMeta, averageRating, PERMISSION_LABELS, type ModulePermission } from "@/lib/modules/types"
import { formatSurfaces } from "@/lib/modules/surfaces"
import { getSiteUrl } from "@/lib/seo"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const mod = await getModuleBySlug(slug)
  if (!mod) return { title: "Module not found", robots: { index: false, follow: false } }
  return {
    title: `${mod.name} — LingoCon module`,
    description: mod.summary ?? `A ${getModuleTypeMeta(mod.type).label} module for LingoCon.`,
    ...(mod.status !== "PUBLISHED" ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `${getSiteUrl()}/modules/${mod.slug}` },
  }
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [session, userId, mod] = await Promise.all([auth(), getUserId(), getModuleBySlug(slug)])

  if (!mod || mod.status !== "PUBLISHED") notFound()

  const typeMeta = getModuleTypeMeta(mod.type)
  const rating = averageRating(mod.ratingSum, mod.ratingCount)
  const latest = mod.versions.find((v) => v.publishedAt) ?? mod.versions[0]
  const permissions = (latest?.permissions as string[] | null) ?? []

  const accountInstall = userId ? await getInstallState(userId, mod.id, null) : null

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

      <main className="container mx-auto max-w-5xl px-4 py-10">
        <Link
          href="/modules"
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← All modules
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ModuleIcon name={mod.icon ?? typeMeta.icon} className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-3xl tracking-tight">{mod.name}</h1>
                {mod.isOfficial && <BadgeCheck className="h-5 w-5 text-primary" aria-label="Official" />}
              </div>
              {mod.summary && <p className="mt-1 max-w-2xl text-muted-foreground">{mod.summary}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline">{typeMeta.label}</Badge>
                {mod.ratingCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-amber-500" />
                    {rating} ({mod.ratingCount})
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {mod.addCount} added
                </span>
                {latest && <span>v{latest.version}</span>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Where it applies: {formatSurfaces(mod.type)}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <AddModuleButton
              moduleId={mod.id}
              permissions={permissions}
              isAuthenticated={Boolean(userId)}
              installId={accountInstall?.id ?? null}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
          {/* Main column */}
          <div className="min-w-0 space-y-8">
            {mod.description ? (
              <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-primary">
                <DocMarkdown content={mod.description} />
              </div>
            ) : (
              <p className="text-muted-foreground">No description provided yet.</p>
            )}

            {/* Reviews */}
            <section>
              <h2 className="mb-4 font-serif text-xl">Reviews</h2>
              {mod.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <div className="space-y-4">
                  {mod.reviews.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="pt-5">
                        <div className="mb-2 flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={r.user.image ?? undefined} />
                            <AvatarFallback>{(r.user.name ?? "?").charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{r.user.name ?? "Anonymous"}</span>
                          <span className="ml-auto flex items-center gap-0.5 text-amber-500">
                            {Array.from({ length: r.rating }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-current" />
                            ))}
                          </span>
                        </div>
                        {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No special permissions requested.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {permissions.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {PERMISSION_LABELS[p as ModulePermission] ?? p}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={mod.author?.image ?? undefined} />
                    <AvatarFallback>{(mod.author?.name ?? "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">{mod.author?.name ?? "Unknown"}</span>
                </div>
                {mod.license && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">License</span>
                    <span>{mod.license}</span>
                  </div>
                )}
                {mod.repoUrl && (
                  <a
                    href={mod.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Github className="h-4 w-4" />
                    Source code
                  </a>
                )}
                {mod.homepageUrl && (
                  <a
                    href={mod.homepageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Homepage
                  </a>
                )}
                {userId && (
                  <div className="border-t border-border/40 pt-3">
                    <ReportModuleButton moduleId={mod.id} />
                  </div>
                )}
              </CardContent>
            </Card>

            {mod.versions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Versions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    {mod.versions.slice(0, 8).map((v) => (
                      <li key={v.id}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">v{v.version}</span>
                          {v.yanked && <Badge variant="destructive" className="text-[10px]">yanked</Badge>}
                        </div>
                        {v.changelog && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{v.changelog}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
