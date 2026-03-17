import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { FamilyViewSwitcher } from "./components/family-view-switcher"
import { DashboardTour } from "@/components/onboarding/dashboard-tour"
import { getAncestorIds } from "@/lib/utils/family-graph"

export const metadata = {
  title: "Language Families | Dashboard",
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = "force-dynamic"

export default async function FamiliesDashboardPage() {
  const session = await auth()

  if (!session?.user?.id && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const userId = session?.user?.id || (await getDevUserId())

  // Get all user's languages
  const userLanguages = await prisma.language.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      parentLanguageId: true,
      externalAncestry: true,
      ownerId: true,
      createdAt: true,
      _count: {
        select: {
          dictionaryEntries: true,
        }
      }
    },
    orderBy: { createdAt: "asc" }
  })

  // Batch-fetch all missing ancestors in a single CTE query
  const userLanguageIds = userLanguages.map(l => l.id)
  const missingAncestorIds = await getAncestorIds(userLanguageIds)

  let ancestors: typeof userLanguages & { owner?: any }[] = []
  if (missingAncestorIds.length > 0) {
    ancestors = await prisma.language.findMany({
      where: { id: { in: missingAncestorIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        parentLanguageId: true,
        externalAncestry: true,
        ownerId: true,
        createdAt: true,
        owner: { select: { id: true, name: true, image: true } },
        _count: { select: { dictionaryEntries: true } }
      }
    })
  }

  const allLanguages = [...userLanguages, ...ancestors]

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardTour />
      <Navbar user={user as any} isDevMode={isDevMode} />
      <div className="h-14 shrink-0" />

      {/* Full bleed canvas area */}
      <main className="flex-1 relative flex flex-col">
        <div className="absolute inset-0">
          <FamilyViewSwitcher initialLanguages={allLanguages} currentUserId={userId} />
        </div>
      </main>
    </div>
  )
}
