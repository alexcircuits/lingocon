import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage, EDITOR_DEFAULT_PERMISSIONS } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/admin"
import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import { PATHNAME_HEADER, withRenamedSlug } from "@/lib/project-path"
import { StudioLayout, type StudioShellLanguage } from "../studio-layout"
import { FontLoader } from "@/components/font-loader"
import { getStudioNavInstalls } from "@/lib/services/module"
import { getLanguageCounts } from "@/lib/services/language-counts"
import { findReservedSlugTarget } from "@/lib/services/slug-reservation"
import type { ModuleNavTab } from "@/lib/studio-nav"


export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

async function getLanguage(slug: string, userId: string | null) {

  // Only the fields the studio shell renders: this object is serialized to the
  // client StudioLayout on every hard load and refresh, and any signed-in user can
  // open the studio of a public language (no metadata JSON, description, owner…).
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      ownerId: true,
      updatedAt: true,
      fontUrl: true,
      fontFamily: true,
      fontScale: true,
    },
  })

  if (!language) {
    return null
  }

  // Allow access if user can view (owner, collaborator, or public) - skip in dev mode
  if (process.env.DEV_MODE !== "true" && userId) {
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) {
      return null
    }
  }

  // Scoped counts — Prisma's relation _count aggregates every language's rows (see language-counts).
  const counts = await getLanguageCounts(language.id, [
    "scriptSymbols",
    "grammarPages",
    "dictionaryEntries",
    "paradigms",
    "articles",
    "texts",
  ] as const)
  return { ...language, _count: counts }
}

async function getCollaboratorPermissions(languageId: string, userId: string): Promise<string[]> {
  const collab = await prisma.languageCollaborator.findUnique({
    where: { languageId_userId: { languageId, userId } },
    select: { role: true, permissions: true },
  })
  // Legacy EDITOR with empty permissions = full default set
  if (collab?.role === "EDITOR" && collab.permissions.length === 0) {
    return [...EDITOR_DEFAULT_PERMISSIONS]
  }
  return collab?.permissions ?? []
}

async function getModuleTabs(userId: string, languageId: string, slug: string): Promise<ModuleNavTab[]> {
  const installs = await getStudioNavInstalls(userId, languageId)
  return installs.map((i) => ({
    name: i.module.name,
    href: `/studio/lang/${slug}/modules/${i.module.slug}`,
    icon: i.module.icon,
  }))
}

export default async function StudioLangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const language = await getLanguage(slug, userId)

  if (!language) {
    // Renamed projects keep their old slug reserved. Full page loads are
    // redirected by middleware; client navigations land here instead.
    const target = await findReservedSlugTarget(slug)
    // Same section of the renamed project (the middleware passes the requested path).
    if (target) redirect(withRenamedSlug(headers().get(PATHNAME_HEADER), "/studio/lang", slug, target))
    notFound()
  }

  const isOwner = userId === language.ownerId

  // Independent reads: collaborator permissions (non-owners) and the tabs
  // contributed by the user's enabled modules.
  const [userPermissions, moduleTabs, admin] = await Promise.all([
    userId && !isOwner ? getCollaboratorPermissions(language.id, userId) : Promise.resolve<string[]>([]),
    userId ? getModuleTabs(userId, language.id, language.slug) : Promise.resolve<ModuleNavTab[]>([]),
    // Admins may edit every section's content (canEditScope), so the UI must not lock them out.
    userId && !isOwner ? isAdmin() : Promise.resolve(false),
  ])

  const shellLanguage: StudioShellLanguage = {
    id: language.id,
    name: language.name,
    slug: language.slug,
    visibility: language.visibility,
    updatedAt: language.updatedAt,
    _count: language._count,
  }

  return (
    <StudioLayout language={shellLanguage} moduleTabs={moduleTabs} userPermissions={userPermissions} isOwner={isOwner} hasFullAccess={admin}>
      <FontLoader fontUrl={language.fontUrl} fontFamily={language.fontFamily} fontScale={language.fontScale} />
      {children}
    </StudioLayout>
  )
}

