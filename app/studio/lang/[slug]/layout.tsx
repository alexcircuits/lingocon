import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage, EDITOR_DEFAULT_PERMISSIONS } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { StudioLayout } from "../studio-layout"
import { FontLoader } from "@/components/font-loader"
import { getStudioNavInstalls } from "@/lib/services/module"
import type { ModuleNavTab } from "@/lib/studio-nav"


export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

async function getLanguage(slug: string, userId: string | null) {

  const language = await prisma.language.findUnique({
    where: { slug },
    include: {
      // No email: this object is serialized to the client StudioLayout, and any signed-in user
      // can open the studio of a public language.
      owner: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
          paradigms: true,
          articles: true,
          texts: true,
        },
      },
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

  return language
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
    notFound()
  }

  const isOwner = userId === language.ownerId

  // Fetch collaborator permissions for non-owners
  let userPermissions: string[] = []
  if (userId && !isOwner) {
    const collab = await prisma.languageCollaborator.findUnique({
      where: { languageId_userId: { languageId: language.id, userId } },
      select: { role: true, permissions: true },
    })
    // Legacy EDITOR with empty permissions = full default set
    if (collab?.role === "EDITOR" && collab.permissions.length === 0) {
      userPermissions = [...EDITOR_DEFAULT_PERMISSIONS]
    } else {
      userPermissions = collab?.permissions ?? []
    }
  }

  // Studio-panel tabs contributed by the current user's enabled modules.
  let moduleTabs: ModuleNavTab[] = []
  if (userId) {
    const installs = await getStudioNavInstalls(userId, language.id)
    moduleTabs = installs.map((i) => ({
      name: i.module.name,
      href: `/studio/lang/${language.slug}/modules/${i.module.slug}`,
      icon: i.module.icon,
    }))
  }

  return (
    <StudioLayout language={language} moduleTabs={moduleTabs} userPermissions={userPermissions} isOwner={isOwner}>
      <FontLoader fontUrl={language.fontUrl} fontFamily={language.fontFamily} fontScale={language.fontScale} />
      {children}
    </StudioLayout>
  )
}

