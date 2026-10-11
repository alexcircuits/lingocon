import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GrammarPagesManager, NewGrammarPageButton } from "./grammar-pages-manager"
import { documentToPlainText } from "@/lib/utils/tiptap-text"

async function getLanguage(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      grammarPages: {
        orderBy: {
          order: "asc",
        },
        // `content` is read only to count words here on the server; the client list receives just
        // the displayed fields (see `pages` below), not every page's full document.
        select: { id: true, title: true, slug: true, updatedAt: true, content: true },
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

export default async function GrammarPage({
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
  const language = await getLanguage(slug, userId)
  const t = await getTranslations("studio.grammar")

  if (!language) {
    notFound()
  }

  // Compute per-page word counts server-side
  const wordCountsById = new Map(
    language.grammarPages.map((p) => {
      const text = documentToPlainText(p.content)
      const count = text.length > 0 ? text.split(/\s+/).length : 0
      return [p.id, count]
    })
  )
  const totalWords = Array.from(wordCountsById.values()).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">
            {t("pageDescription")}
          </p>
          {language.grammarPages.length > 0 && (
            <span className="mt-2 block text-xs text-muted-foreground tabular-nums sm:hidden">
              {t("pageCount", { count: language.grammarPages.length })}
              {" · "}
              {t("wordCount", { count: totalWords })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {language.grammarPages.length > 0 && (
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
              {t("pageCount", { count: language.grammarPages.length })}
              {" · "}
              {t("wordCount", { count: totalWords })}
            </span>
          )}
          {/* Only for visitors who may create pages (write:grammar). */}
          <NewGrammarPageButton languageSlug={slug} />
        </div>
      </div>

      <GrammarPagesManager
        languageId={language.id}
        languageSlug={slug}
        pages={language.grammarPages.map(({ id, title, slug, updatedAt }) => ({ id, title, slug, updatedAt }))}
        wordCountsById={Object.fromEntries(wordCountsById)}
      />
    </div>
  )
}
