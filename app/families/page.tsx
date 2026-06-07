import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { getSiteUrl } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { FamiliesView } from "./families-view"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.families")
  return {
    title: t("title"),
    description: t("description"),
    keywords: ["conlang family tree", "constructed language families", "language family map", "conlang genealogy", "proto-language", "conlang lineage"],
    alternates: {
      canonical: `${getSiteUrl()}/families`,
    },
  }
}

export default async function PublicFamiliesPage() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"

  const userId = session?.user?.id ?? null

  const languageSelect = {
    id: true,
    name: true,
    slug: true,
    flagUrl: true,
    parentLanguageId: true,
    externalAncestry: true,
    familyId: true,
    family: { select: { id: true, name: true } },
    owner: { select: { name: true } },
    _count: { select: { dictionaryEntries: true } },
  } as const

  const languages = await prisma.language.findMany({
    where: userId
      ? { OR: [{ visibility: "PUBLIC" }, { ownerId: userId }] }
      : { visibility: "PUBLIC" },
    select: languageSelect,
    orderBy: { createdAt: "asc" },
  })

  const user = session?.user
    ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null

  const t = await getTranslations("families")

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Navbar user={user} isDevMode={isDevMode} />

      <main className="flex-1 overflow-hidden" style={{ paddingTop: "3.5rem" }}>
        {languages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md px-6">
              <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h2 className="text-2xl font-serif font-medium">{t("emptyTitle")}</h2>
              <p className="text-muted-foreground">
                {t("emptyDesc")}
              </p>
            </div>
          </div>
        ) : (
          <FamiliesView languages={languages} />
        )}
      </main>
    </div>
  )
}
