import { prisma } from "@/lib/prisma"
import { getLanguageCounts } from "@/lib/services/language-counts"
import { ActivityFeed } from "@/components/activity-feed"
import { getActivitiesForLanguage } from "@/lib/utils/activity"
import { formatDate } from "@/lib/utils"
import {
  getPosDistribution,
  getActivityHistory,
  getCompletenessStats
} from "@/app/actions/analytics"

// Lazy-loaded from a client module: `next/dynamic` called here, in a Server
// Component, left the charting library in this route's first-load bundle.
import { LazyActivityChart as ActivityChart, LazyPosDistributionChart as PosDistributionChart } from "@/components/analytics/lazy-charts"
import { CompletenessCard } from "@/components/analytics/completeness-card"
import { OverviewSwadesh, OverviewWarnings } from "./components/overview-lexicon-sections"
import { Skeleton } from "@/components/ui/skeleton"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Calendar, Eye, FileText, Activity, Plus, BookOpen, PenLine } from "lucide-react"
import { InlineLanguageEdit } from "./components/inline-language-edit"
import { CopyButton } from "@/lib/hooks/use-copy-to-clipboard"
import { StudioTour } from "@/components/onboarding/studio-tour"
import { ContextualHelp } from "@/components/contextual-help"
import { IfCanWrite } from "@/components/studio-access"

// Only the columns the overview uses: it previously included every dictionary entry, grammar page
// (full rich-text JSON), symbol and paradigm with all columns just to show a few numbers,
// validation warnings and the Swadesh tracker.
const languageSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  visibility: true,
  allowsDiacritics: true,
  createdAt: true,
} as const

async function getLanguageDetails(slug: string) {
  const language = await prisma.language.findUnique({ where: { slug }, select: languageSelect })
  if (!language) return null
  const counts = await getLanguageCounts(language.id, [
    "scriptSymbols",
    "grammarPages",
    "dictionaryEntries",
    "paradigms",
  ] as const)
  return { ...language, _count: counts }
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguageDetails(slug)

  if (!language) {
    // An explicit not-found inside the studio shell, never an empty page.
    notFound()
  }

  const [
    activities,
    posData,
    activityHistory,
    completenessStats
  ] = await Promise.all([
    getActivitiesForLanguage(language.id, 10),
    getPosDistribution(language.id),
    getActivityHistory(language.id),
    getCompletenessStats(language.id)
  ])

  const t = await getTranslations("studio.overview")

  const quickActions = [
    {
      label: t("addWord"),
      href: `/studio/lang/${language.slug}/dictionary`,
      icon: Plus,
      color: "emerald"
    },
    {
      label: t("newPage"),
      href: `/studio/lang/${language.slug}/grammar/new`,
      icon: BookOpen,
      color: "violet"
    },
    {
      label: t("writeArticle"),
      href: `/studio/lang/${language.slug}/articles/new`,
      icon: PenLine,
      color: "amber"
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-3xl font-bold tracking-tight mb-1">{language.name}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon
          const colorMap = {
            emerald: "hover:border-primary hover:text-primary",
            violet: "hover:border-primary hover:text-primary",
            amber: "hover:border-primary hover:text-primary",
          }
          return (
            <Link key={action.label} href={action.href}>
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 ${colorMap[action.color as keyof typeof colorMap]}`}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Button>
            </Link>
          )
        })}
      </div>

      {/* Whole-lexicon analysis streams in; the rest of the page doesn't wait for it. */}
      <Suspense fallback={null}>
        <OverviewWarnings languageId={language.id} allowsDiacritics={language.allowsDiacritics} />
      </Suspense>

      {/* Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ActivityChart data={activityHistory} />
        </div>
        <PosDistributionChart data={posData} />
        <CompletenessCard stats={completenessStats} />
        <Suspense fallback={<Skeleton className="h-[220px] w-full rounded-xl" />}>
          <OverviewSwadesh languageId={language.id} allowsDiacritics={language.allowsDiacritics} />
        </Suspense>
      </div>

      {/* Details & Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Language Details */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {t("languageDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("name")}</span>
                  <IfCanWrite permission="write:settings">
                    <ContextualHelp
                      content={t("editHint")}
                      variant="icon"
                    />
                  </IfCanWrite>
                </div>
                <InlineLanguageEdit
                  languageId={language.id}
                  field="name"
                  value={language.name}
                  maxLength={100}
                  label={t("name")}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("slug")}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-sm bg-muted px-2 py-1 rounded truncate min-w-0">{language.slug}</code>
                  <CopyButton text={language.slug} message={t("copied")} size="sm" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("description")}</span>
              <InlineLanguageEdit
                languageId={language.id}
                field="description"
                value={language.description || ""}
                maxLength={1000}
                label={t("description")}
              />
            </div>

            <div className="pt-2 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{language.visibility.toLowerCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formatDate(language.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {t("recentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[280px] overflow-y-auto pr-2 -mr-2">
              <ActivityFeed activities={activities} showLanguage={false} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

