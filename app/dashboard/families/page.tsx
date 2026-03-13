import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { LanguageFamilyBuilder } from "./components/language-family-builder"
import { getLanguageFamilyTree } from "@/app/actions/language-family"
import { DashboardTour } from "@/components/onboarding/dashboard-tour"

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
  const languages = await prisma.language.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      parentLanguageId: true,
      _count: {
        select: {
          dictionaryEntries: true,
        }
      }
    },
    orderBy: { createdAt: "asc" }
  })

  // Group languages into independent trees
  // 1. Find all root languages (those without a parent)
  const rootLanguages = languages.filter(l => !l.parentLanguageId)
  
  // 2. We'll pass the flat list to the client to let React Flow arrange them
  // Or if we want pre-built trees we can fetch them here.
  // For the builder canvas, a flat array with parentIds is actually perfect 
  // because React Flow computes nodes and edges from flat lists.

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
          <LanguageFamilyBuilder initialLanguages={languages} />
        </div>
      </main>
    </div>
  )
}
