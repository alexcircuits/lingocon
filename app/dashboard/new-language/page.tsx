import { getUserId } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { CreateLanguageForm } from "./form"
import { LanguageWizard } from "./wizard"
import { WizardEntry } from "./wizard-entry"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default async function NewLanguagePage({
  searchParams,
}: {
  searchParams: Promise<{ wizard?: string, from?: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const userLanguages = userId ? await prisma.language.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  }) : []

  const navUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, isAdmin: true },
  }) : null
  const isDevMode = process.env.DEV_MODE === "true"

  const params = await searchParams
  const useWizard = params.wizard === "true"
  const fromSlug = params.from

  // If evolving from a public language, fetch its details and prepend to the list
  let initialParentId = "none"
  if (fromSlug) {
    const parentLang = await prisma.language.findUnique({
      where: { slug: fromSlug, visibility: "PUBLIC" },
      select: { id: true, name: true, owner: { select: { name: true } } },
    })
    
    if (parentLang) {
      initialParentId = parentLang.id
      // Add the public language to the dropdown options with the owner's name
      userLanguages.unshift({ 
        id: parentLang.id, 
        name: `${parentLang.name} (by ${parentLang.owner.name})` 
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar user={navUser} isDevMode={isDevMode} />
      <div className="h-14" />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Create New Language</h1>
          <p className="mt-2 text-muted-foreground">
            Start documenting your constructed language
          </p>
        </div>

        {useWizard ? (
          <LanguageWizard />
        ) : (
          <Card className="p-6">
            <WizardEntry />
            <div className="mt-6 pt-6 border-t">
              <CreateLanguageForm userLanguages={userLanguages} initialParentId={initialParentId} />
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  )
}

