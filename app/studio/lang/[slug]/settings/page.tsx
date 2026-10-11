import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { LanguageSettings } from "./language-settings"
import { Collaborators, TransferOwnershipCard } from "./collaborators"
import { ParentLanguageCard } from "./parent-language-card"
import { getLanguageFamilyTree } from "@/app/actions/language-family"

async function findLanguage(slug: string) {
  return prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      visibility: true,
      category: true,
      flagUrl: true,
      fontUrl: true,
      fontFamily: true,
      fontScale: true,
      allowsDiacritics: true,
      allowForking: true,
      acceptRomanizedAnswers: true,
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
      familyId: true,
      family: {
        select: {
          id: true,
          name: true,
          description: true,
        }
      },
    },
  })
}

/** Non-fatal: the page renders without the family tree. */
async function loadFamilyTree(languageId: string) {
  try {
    return await getLanguageFamilyTree(languageId)
  } catch (error) {
    console.error("Failed to load language family tree:", error)
    return null
  }
}

/** The settings form owns only `metadata.tts`; the rest of the metadata is not sent to it. */
function ttsMetadata(metadata: unknown): { tts?: unknown } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}
  const tts = (metadata as Record<string, unknown>).tts
  return tts === undefined ? {} : { tts }
}

/**
 * Fetch the language, authorize, then load everything else in parallel. This used to be a long
 * sequential waterfall, and it read 50 recent dictionary entries (filtered by `language.slug`,
 * which misses the languageId index) that the client never used — before authorizing. It also
 * read the user's other languages, families and this language's descendants for props the
 * family card no longer uses (its pickers search through server actions).
 */
async function getSettingsData(slug: string, userId: string | null) {
  const language = await findLanguage(slug)
  if (!language) return null

  // Allow access if user is owner or collaborator (skip in dev mode)
  if (process.env.DEV_MODE !== "true" && userId && !(await canViewLanguage(language.id, userId))) {
    return null
  }

  const familyTree = await loadFamilyTree(language.id)

  return { language, familyTree }
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
  const [data, t] = await Promise.all([
    getSettingsData(slug, userId),
    getTranslations("studio.settings"),
  ])

  if (!data) {
    notFound()
  }

  const { language, familyTree } = data
  const owner = !!userId && language.ownerId === userId
  // Only what the form renders: not the owner, parent/family relations or the whole metadata
  // document (sound-change rules, phonology…), which used to ride along in the page payload.
  const settingsLanguage = {
    id: language.id,
    name: language.name,
    slug: language.slug,
    description: language.description,
    visibility: language.visibility,
    category: language.category,
    flagUrl: language.flagUrl,
    fontUrl: language.fontUrl,
    fontFamily: language.fontFamily,
    fontScale: language.fontScale,
    allowsDiacritics: language.allowsDiacritics,
    allowForking: language.allowForking,
    acceptRomanizedAnswers: language.acceptRomanizedAnswers,
    discordUrl: language.discordUrl,
    telegramUrl: language.telegramUrl,
    websiteUrl: language.websiteUrl,
    metadata: ttsMetadata(language.metadata),
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">
          {t("pageDescription")}
        </p>
      </div>

      <LanguageSettings language={settingsLanguage} languageSlug={slug} isOwner={owner} />
      <ParentLanguageCard
        languageId={language.id}
        currentParentId={language.parentLanguageId || null}
        initialParent={language.parentLanguage}
        initialFamilyId={language.familyId ?? null}
        initialFamily={language.family ?? null}
        familyTree={familyTree}
        currentSlug={slug}
        // Setting the parent or family and syncing from the parent are owner-only on the server
        // (the family service checks ownerId); other editors would only be offered refused pickers.
        isOwner={owner}
      />
      <Collaborators languageId={language.id} languageSlug={slug} isOwner={owner} />
      {owner && <TransferOwnershipCard languageId={language.id} languageSlug={slug} />}
    </div>
  )
}
