import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { FamilyViewSwitcher } from "./components/family-view-switcher"
import { DashboardTour } from "@/components/onboarding/dashboard-tour"
import { getAncestorIds } from "@/lib/utils/family-graph"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.dashboardFamilies")
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  }
}

export const dynamic = "force-dynamic"

export default async function FamiliesDashboardPage() {
  const session = await auth()

  if (!session?.user?.id && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const userId = session?.user?.id || (await getDevUserId())

  // Load user's own languages
  const userLanguages = await prisma.language.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      parentLanguageId: true,
      externalAncestry: true,
      familyId: true,
      family: { select: { id: true, name: true } },
      ownerId: true,
      createdAt: true,
      _count: { select: { dictionaryEntries: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  // Batch-fetch ancestor languages referenced by the user's languages
  const userLanguageIds = userLanguages.map(l => l.id)
  const missingAncestorIds = await getAncestorIds(userLanguageIds)

  const ancestors =
    missingAncestorIds.length > 0
      ? await prisma.language.findMany({
          where: { id: { in: missingAncestorIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            parentLanguageId: true,
            externalAncestry: true,
            familyId: true,
            family: { select: { id: true, name: true } },
            ownerId: true,
            createdAt: true,
            owner: { select: { id: true, name: true, image: true } },
            _count: { select: { dictionaryEntries: true } },
          },
        })
      : []

  const allLanguages = [...userLanguages, ...ancestors]

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
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <DashboardTour />
      <Navbar user={user} isDevMode={isDevMode} />

      {/* Canvas area — fills remaining viewport height */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingTop: "3.5rem" }}>
        <FamilyViewSwitcher initialLanguages={allLanguages} currentUserId={userId!} />
      </div>
    </div>
  )
}
