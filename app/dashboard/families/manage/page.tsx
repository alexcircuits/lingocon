import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { GitFork, Globe } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { FamilyManager } from "./family-manager"

export const metadata = {
  title: "Manage Families | Dashboard",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ManageFamiliesPage() {
  const session = await auth()

  if (!session?.user?.id && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const userId = session?.user?.id || (await getDevUserId())

  // Fetch user's families with their languages
  const userFamilies = await prisma.languageFamily.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      visibility: true,
      type: true,
      createdAt: true,
      parentFamilyId: true,
      parentFamily: { select: { id: true, name: true } },
      languages: {
        select: {
          id: true,
          name: true,
          slug: true,
          flagUrl: true,
          _count: { select: { dictionaryEntries: true } },
        },
        orderBy: { name: "asc" },
      },
      _count: { select: { languages: true, protoWords: true } },
    },
    orderBy: { name: "asc" },
  })

  // Fetch user's languages not in any family (for assignment)
  const unassignedLanguages = await prisma.language.findMany({
    where: { ownerId: userId, familyId: null },
    select: {
      id: true,
      name: true,
      slug: true,
      flagUrl: true,
      _count: { select: { dictionaryEntries: true } },
    },
    orderBy: { name: "asc" },
  })

  // All of the user's languages — derive targets for proto-vocabulary.
  const targetLanguages = await prisma.language.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user} isDevMode={isDevMode} />
      <div className="h-14 shrink-0" />

      <main className="flex-1 container max-w-5xl mx-auto py-8 px-4 font-display">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Manage <span className="aurora-gradient-text">Families</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Group your languages into named families. Families color the map and can hold shared
              proto-vocabulary — lineage between languages is set in the Builder.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Link href="/dashboard/families">
                <GitFork className="h-4 w-4" />
                Builder
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Link href="/families">
                <Globe className="h-4 w-4" />
                Public map
              </Link>
            </Button>
          </div>
        </div>
        <FamilyManager
          families={userFamilies}
          unassignedLanguages={unassignedLanguages}
          targetLanguages={targetLanguages}
        />
      </main>
    </div>
  )
}
