import { prisma } from "@/lib/prisma"
import { getUserId, isLanguageOwner } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { LanguageSettings } from "./language-settings"
import { Collaborators } from "./collaborators"
import { ParentLanguageCard } from "./parent-language-card"
import { getLanguageFamilyTree } from "@/app/actions/language-family"
import { getDescendantIds } from "@/lib/utils/family-graph"
import { getUserFamilies } from "@/app/actions/language-family"

async function getLanguage(slug: string, userId: string | null) {
  const [language, dictionaryEntries] = await Promise.all([
    prisma.language.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        visibility: true,
        flagUrl: true,
        fontUrl: true,
        fontFamily: true,
        fontScale: true,
        allowsDiacritics: true,
        allowForking: true,
        discordUrl: true,
        telegramUrl: true,
        websiteUrl: true,
        ownerId: true,
        metadata: true,
        parentLanguageId: true,
        parentLanguage: {
          select: {
            id: true,
            name: true,
            owner: { select: { name: true } }
          }
        },
        externalAncestry: true,
        familyId: true,
        family: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        },
      },
    }),
    prisma.dictionaryEntry.findMany({
      where: { language: { slug } },
      select: {
        id: true,
        lemma: true,
        ipa: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  if (!language) {
    return null
  }

  // Allow access if user is owner or collaborator (skip in dev mode)
  if (process.env.DEV_MODE !== "true" && userId) {
    const { canViewLanguage } = await import("@/lib/auth-helpers")
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) {
      return null
    }
  }

  // Get user's other languages for parent selector
  const userLanguages = userId ? await prisma.language.findMany({
    where: {
      ownerId: userId,
      id: { not: language.id },
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  }) : []

  // Single CTE query to collect all descendant IDs (replaces BFS loop)
  const descendantIdList = await getDescendantIds(language.id)

  // Get user's families for family selector
  const families = userId ? await getUserFamilies() : []

  return { language, dictionaryEntries, userLanguages, descendantIds: descendantIdList, families }
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const data = await getLanguage(slug, userId)

  if (!data) {
    notFound()
  }

  const { language, dictionaryEntries, userLanguages, descendantIds, families } = data
  const owner = userId ? await isLanguageOwner(language.id, userId) : false
  
  // Get family tree if language has a parent or children
  let familyTree = null
  try {
    familyTree = await getLanguageFamilyTree(language.id)
  } catch {}

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-3xl font-serif tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground">
          Manage language settings and preferences
        </p>
      </div>

      <LanguageSettings language={language} languageSlug={slug} dictionaryEntries={dictionaryEntries} isOwner={owner} />
      <ParentLanguageCard
        languageId={language.id}
        currentParentId={language.parentLanguageId || null}
        initialParent={(language as any).parentLanguage}
        initialExternalAncestry={language.externalAncestry}
        initialFamilyId={(language as any).familyId || null}
        initialFamily={(language as any).family || null}
        families={families}
        userLanguages={userLanguages}
        descendantIds={descendantIds}
        familyTree={familyTree}
        currentSlug={slug}
      />
      <Collaborators languageId={language.id} isOwner={owner} />
    </div>
  )
}
