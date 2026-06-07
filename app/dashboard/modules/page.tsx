import Link from "next/link"
import { redirect } from "next/navigation"
import { getUserId } from "@/lib/auth-helpers"
import { getTranslations } from "next-intl/server"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Blocks, Download, Star, FlaskConical, BookOpen } from "lucide-react"
import { ModuleIcon } from "@/components/modules/module-icon"
import { getAuthorModules } from "@/lib/services/module"
import { getModuleTypeMeta, averageRating } from "@/lib/modules/types"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardModules")
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  }
}
export const dynamic = "force-dynamic"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  IN_REVIEW: "outline",
  SUSPENDED: "destructive",
  DEPRECATED: "outline",
}

export default async function DashboardModulesPage() {
  const userId = await getUserId()
  if (!userId) redirect("/login")

  const [modules, navUser, t] = await Promise.all([
    getAuthorModules(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, isAdmin: true },
    }),
    getTranslations("dashboardModules"),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar user={navUser} isDevMode={process.env.DEV_MODE === "true"} />
      <div className="h-14" />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-10">
        <div className="mb-8 flex items-end justify-between border-b border-border/40 pb-6">
          <div>
            <h1 className="flex items-center gap-2 font-serif text-3xl tracking-tight">
              <Blocks className="h-7 w-7 text-primary" />
              {t("pageTitle")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/modules/docs">
              <Button variant="ghost">
                <BookOpen className="mr-2 h-4 w-4" />
                {t("docs")}
              </Button>
            </Link>
            <Link href="/dashboard/modules/playground">
              <Button variant="outline">
                <FlaskConical className="mr-2 h-4 w-4" />
                {t("playground")}
              </Button>
            </Link>
            <Link href="/dashboard/modules/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("newModule")}
              </Button>
            </Link>
          </div>
        </div>

        {modules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Blocks className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium">{t("emptyTitle")}</p>
              <Link href="/dashboard/modules/new">
                <Button>{t("createFirst")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {modules.map((m) => {
              const typeMeta = getModuleTypeMeta(m.type)
              return (
                <Link key={m.slug} href={`/dashboard/modules/${m.id}`}>
                  <Card className="transition-all hover:border-primary/40">
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ModuleIcon name={m.icon ?? typeMeta.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{m.name}</span>
                          <Badge variant={STATUS_VARIANT[m.status] ?? "outline"} className="text-[10px]">
                            {m.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{typeMeta.label}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {m.ratingCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                            {averageRating(m.ratingSum, m.ratingCount)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" />
                          {m.addCount}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
