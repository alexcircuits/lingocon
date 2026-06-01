import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getUserId } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { ModuleEditor, type EditorVersion } from "@/components/modules/module-editor"
import { getModuleTypeMeta } from "@/lib/modules/types"

export const metadata = { title: "Edit Module", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await getUserId()
  if (!userId) redirect("/login")

  const [mod, navUser] = await Promise.all([
    prisma.module.findUnique({
      where: { id },
      include: { versions: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, isAdmin: true },
    }),
  ])

  if (!mod || mod.authorId !== userId) notFound()

  const typeMeta = getModuleTypeMeta(mod.type)
  const versions: EditorVersion[] = mod.versions.map((v) => ({
    id: v.id,
    version: v.version,
    changelog: v.changelog,
    yanked: v.yanked,
    permissions: (v.permissions as string[] | null) ?? [],
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar user={navUser} isDevMode={process.env.DEV_MODE === "true"} />
      <div className="h-14" />

      <main className="container mx-auto max-w-3xl flex-1 px-4 py-10">
        <Link
          href="/dashboard/modules"
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← My modules
        </Link>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl tracking-tight">{mod.name}</h1>
              <Badge variant="outline">{mod.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {typeMeta.label} · /modules/{mod.slug}
            </p>
          </div>
          {mod.status === "PUBLISHED" && (
            <Link href={`/modules/${mod.slug}`} target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                View public
              </Button>
            </Link>
          )}
        </div>

        <ModuleEditor
          module={{
            id: mod.id,
            slug: mod.slug,
            status: mod.status,
            tier: mod.tier,
            type: mod.type,
            name: mod.name,
            summary: mod.summary,
            description: mod.description,
            icon: mod.icon,
            repoUrl: mod.repoUrl,
            homepageUrl: mod.homepageUrl,
            license: mod.license,
          }}
          versions={versions}
        />
      </main>
      <Footer />
    </div>
  )
}
