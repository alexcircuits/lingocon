import Link from "next/link"
import { redirect } from "next/navigation"
import { getUserId } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Blocks } from "lucide-react"
import {
  AccountModulesList,
  type AccountInstall,
} from "@/components/modules/account-modules-list"

export const metadata = { title: "Module settings", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function SettingsModulesPage() {
  const userId = await getUserId()
  if (!userId) redirect("/login")

  const rows = await prisma.moduleInstall.findMany({
    where: { userId, languageId: null },
    include: {
      module: { select: { slug: true, name: true, icon: true, type: true } },
      version: { select: { version: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const installs: AccountInstall[] = rows.map((r) => ({
    installId: r.id,
    moduleSlug: r.module.slug,
    name: r.module.name,
    icon: r.module.icon,
    type: r.module.type,
    version: r.version.version,
    grantedPermissions: (r.grantedPermissions as string[] | null) ?? [],
  }))

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Blocks className="h-6 w-6 text-primary" />
          Account-wide modules
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modules you added across all your languages, and the permissions you granted them.
        </p>
      </div>

      <AccountModulesList installs={installs} />

      <div className="mt-6">
        <Link href="/modules">
          <Button variant="outline">Browse the catalog</Button>
        </Link>
      </div>
    </div>
  )
}
