import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { Button } from "@/components/ui/button"
import { Blocks } from "lucide-react"
import { getEnabledInstallsForUser } from "@/lib/services/module"
import { ModuleHowItWorks } from "@/components/modules/module-how-it-works"
import {
  LanguageModulesManager,
  type ManagerInstall,
} from "@/components/modules/language-modules-manager"
import {
  StudioRecommendedModules,
  type RecommendedModule,
} from "@/components/modules/studio-recommended-modules"

export const dynamic = "force-dynamic"

const OFFICIAL_TRY_SLUGS = [
  "vowel-space-chart",
  "live-conjugator",
  "classic-sound-changes",
  "parchment-theme",
] as const

export default async function StudioModulesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getUserId()

  const language = await prisma.language.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  })
  if (!language) notFound()

  const canEdit = await canEditLanguage(language.id, userId)
  if (!canEdit) notFound()

  const [rawInstalls, officialMods] = await Promise.all([
    getEnabledInstallsForUser(userId!, language.id),
    prisma.module.findMany({
      where: { status: "PUBLISHED", isOfficial: true, slug: { in: [...OFFICIAL_TRY_SLUGS] } },
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        type: true,
        summary: true,
        versions: {
          where: { yanked: false, publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 1,
          select: { permissions: true },
        },
      },
    }),
  ])

  const installedIds = new Set(rawInstalls.map((i) => i.module.id))
  const recommended: RecommendedModule[] = officialMods
    .filter((m) => !installedIds.has(m.id) && m.versions[0])
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      type: m.type,
      summary: m.summary,
      permissions: (m.versions[0].permissions as string[] | null) ?? [],
    }))

  const installs: ManagerInstall[] = rawInstalls.map((i) => ({
    installId: i.id,
    moduleSlug: i.module.slug,
    name: i.module.name,
    icon: i.module.icon,
    type: i.module.type,
    version: i.version.version,
    accountWide: i.languageId === null,
    languageSlug: language.slug,
  }))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl tracking-tight">
            <Blocks className="h-6 w-6 text-primary" />
            Modules
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tools and widgets for <strong>{language.name}</strong>. What you enable here is what
            runs in the studio and on your public page.
          </p>
        </div>
        <Link href="/modules">
          <Button variant="outline">Browse catalog</Button>
        </Link>
      </div>

      <ModuleHowItWorks languageSlug={language.slug} />

      <StudioRecommendedModules
        languageId={language.id}
        languageName={language.name}
        modules={recommended}
      />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Enabled for this language ({installs.length})
        </h2>
        <LanguageModulesManager installs={installs} languageSlug={language.slug} />
      </div>
    </div>
  )
}
