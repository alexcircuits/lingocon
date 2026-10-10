import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, FileText, Calendar, User, CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { EmptyState } from "@/components/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { publishArticle } from "@/app/actions/article"
import * as articleService from "@/lib/services/article"
import { getTranslations } from "next-intl/server"

/** Why a draft publish failed. Only this code travels in the URL — never a message — so a crafted link cannot put text on the page. */
type PublishFailure = "forbidden" | "failed"

function publishFailureOf(message: string): PublishFailure {
  return /permission|unauthorized/i.test(message) ? "forbidden" : "failed"
}

/**
 * Publish a pending draft from the server-rendered list. The page has no client state to hold a
 * failure, so it returns to the list with a failure code that renders as a notice on that draft.
 */
async function publishDraft(slug: string, formData: FormData) {
  const id = formData.get("id")
  if (typeof id !== "string" || !id) return

  let failure: PublishFailure | null
  try {
    const result = await publishArticle(id)
    failure = "error" in result && result.error ? publishFailureOf(result.error) : null
  } catch (error) {
    console.error("[articles] Failed to publish draft:", error)
    failure = "failed"
  }
  // redirect() throws to navigate, so it stays outside the try.
  const articlesPath = `/studio/lang/${encodeURIComponent(slug)}/articles`
  redirect(failure ? `${articlesPath}?${new URLSearchParams({ draft: id, publishError: failure })}` : articlesPath)
}

async function getPageData(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      articles: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          published: true,
          createdAt: true,
          authorId: true,
          author: { select: { id: true, name: true, image: true } },
        },
      },
    },
  })

  if (!language) return null

  if (process.env.DEV_MODE !== "true" && userId) {
    const { canViewLanguage } = await import("@/lib/auth-helpers")
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) return null
  }

  return language
}

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ draft?: string | string[]; publishError?: string | string[] }>
}) {
  const userId = await getUserId()

  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const language = await getPageData(slug, userId)

  if (!language) notFound()

  // Closes over the route's slug (encrypted by Next), so the redirect target is not client input.
  async function publishDraftAction(formData: FormData) {
    "use server"
    await publishDraft(slug, formData)
  }

  const [canWrite, canDraft] = userId
    ? await Promise.all([
        canEditScope(language.id, userId, "write:articles"),
        canEditScope(language.id, userId, "draft:articles"),
      ])
    : [false, false]

  const canContribute = canWrite || canDraft

  // Drafts awaiting review (only fetched if user has write:articles)
  const pendingDrafts = canWrite && userId
    ? await articleService.getDraftArticles(language.id, userId)
    : []

  // My own drafts — shown for all contributors (canWrite users are excluded from pendingDrafts by design)
  const myDrafts =
    canContribute && userId
      ? language.articles.filter((a) => !a.published && a.authorId === userId)
      : []

  // Published articles + own drafts visible to all studio visitors
  const visibleArticles = language.articles.filter(
    (a) => a.published || (canWrite) || (canDraft && a.authorId === userId)
  )

  const t = await getTranslations("studio.articles")

  // A publish failure notice only shows for a draft still pending review here, with fixed text.
  const { draft: failedDraftId, publishError } = (await searchParams) ?? {}
  const failedDraft = typeof failedDraftId === "string" && typeof publishError === "string"
    ? pendingDrafts.find((d) => d.id === failedDraftId)
    : undefined

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">
            {canWrite
              ? t("writeDesc")
              : canDraft
              ? t("draftDesc")
              : t("browseDesc")}
          </p>
        </div>
        {canContribute && (
          <Link href={`/studio/lang/${slug}/articles/new`}>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {canWrite ? t("newArticle") : t("submitDraft")}
            </Button>
          </Link>
        )}
      </div>

      {/* Pending Review (owners/editors only) */}
      {canWrite && pendingDrafts.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-amber-500" />
            {t("pendingReview")}
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
              {pendingDrafts.length}
            </Badge>
          </h2>
          {failedDraft && (
            <Alert variant="destructive">
              <AlertTitle>{t("publishFailedTitle", { title: failedDraft.title })}</AlertTitle>
              <AlertDescription>
                {publishError === "forbidden" ? t("publishFailedForbidden") : t("publishFailedGeneric")}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3">
            {pendingDrafts.map((draft) => (
              <Card key={draft.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="truncate font-semibold">{draft.title}</h3>
                      <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                        {t("draftBadge")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={(draft.author as any).image || undefined} />
                          <AvatarFallback className="text-[8px]">{(draft.author.name || "U")[0]}</AvatarFallback>
                        </Avatar>
                        {draft.author.name || t("unknown")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/studio/lang/${slug}/articles/${draft.slug}`}>
                      <Button variant="outline" size="sm">{t("review")}</Button>
                    </Link>
                    <form action={publishDraftAction}>
                      <input type="hidden" name="id" value={draft.id} />
                      <Button type="submit" size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("publish")}
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Drafts */}
      {myDrafts.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-muted-foreground" />
            {t("myDrafts")}
          </h2>
          <div className="grid gap-3">
            {myDrafts.map((draft) => (
              <Link key={draft.id} href={`/studio/lang/${slug}/articles/${draft.slug}`}>
                <Card className="cursor-pointer p-4 transition-colors hover:bg-secondary/30">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="truncate font-semibold">{draft.title}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                        {t("pendingReviewBadge")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All published articles */}
      <section className="space-y-4">
        {(pendingDrafts.length > 0 || myDrafts.length > 0) && (
          <h2 className="text-lg font-semibold">{t("publishedArticles")}</h2>
        )}

        {visibleArticles.filter((a) => a.published).length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("noPublishedTitle")}
            description={
              canWrite
                ? t("noPublishedWrite")
                : canDraft
                ? t("noPublishedDraft")
                : t("noPublishedBrowse")
            }
            action={
              canContribute
                ? { label: canWrite ? t("writeFirst") : t("submitADraft"), href: `/studio/lang/${slug}/articles/new` }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-4">
            {visibleArticles
              .filter((a) => a.published)
              .map((article) => (
                <Link key={article.id} href={`/studio/lang/${slug}/articles/${article.slug}`}>
                  <Card className="cursor-pointer p-5 transition-colors hover:bg-secondary/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="truncate text-lg font-semibold">{article.title}</h3>
                          <Badge className="shrink-0 border-green-500/20 bg-green-500/15 text-green-700 hover:bg-green-500/20 dark:text-green-400">
                            {t("publishedBadge")}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {article.author.name || t("unknown")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
