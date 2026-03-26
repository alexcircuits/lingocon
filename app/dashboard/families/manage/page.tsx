import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
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
      _count: { select: { languages: true } },
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

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user as any} isDevMode={isDevMode} />
      <div className="h-14 shrink-0" />

      <main className="flex-1 container max-w-5xl mx-auto py-8 px-4">
        <FamilyManager
          families={userFamilies}
          unassignedLanguages={unassignedLanguages}
        />
      </main>
    </div>
  )
}
