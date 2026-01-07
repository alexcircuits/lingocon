import { prisma } from "@/lib/prisma"
import { getValidationWarnings } from "@/lib/utils/validation"
import { ValidationWarnings } from "@/components/validation-warnings"
import { ActivityFeed } from "@/components/activity-feed"
import { getActivitiesForLanguage } from "@/lib/utils/activity"
import { formatDate } from "@/lib/utils"
import {
  getPosDistribution,
  getActivityHistory,
  getCompletenessStats
} from "@/app/actions/analytics"
import dynamic from "next/dynamic"

const PosDistributionChart = dynamic(() => import("@/components/analytics/pos-distribution-chart").then(mod => mod.PosDistributionChart), { ssr: false })
const ActivityChart = dynamic(() => import("@/components/analytics/activity-chart").then(mod => mod.ActivityChart), { ssr: false })
import { CompletenessCard } from "@/components/analytics/completeness-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar, Eye, FileText, Activity, Plus, BookOpen, PenLine } from "lucide-react"
import { Prisma } from "@prisma/client"
import { InlineLanguageEdit } from "./components/inline-language-edit"
import { CopyButton } from "@/lib/hooks/use-copy-to-clipboard"
import { StudioTour } from "@/components/onboarding/studio-tour"
import { ContextualHelp } from "@/components/contextual-help"

// Define the include type for proper TypeScript inference
const languageInclude = {
  scriptSymbols: true,
  grammarPages: true,
  dictionaryEntries: true,
  paradigms: true,
  _count: {
    select: {
      scriptSymbols: true,
      grammarPages: true,
      dictionaryEntries: true,
      paradigms: true,
    },
  },
} as const

type LanguageWithDetails = Prisma.LanguageGetPayload<{
  include: typeof languageInclude
}>

async function getLanguageDetails(slug: string): Promise<LanguageWithDetails | null> {
  const language = await prisma.language.findUnique({
    where: { slug },
    include: languageInclude,
  })

  return language
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguageDetails(slug)

  if (!language) {
    return null
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

  // Run validation synchronously
  const warnings = getValidationWarnings(
    language.scriptSymbols,
    language.dictionaryEntries,
    language.grammarPages,
    language.paradigms
  )

  const quickActions = [
    {
      label: "Add Word",
      href: `/studio/lang/${language.slug}/dictionary`,
      icon: Plus,
      color: "emerald"
    },
    {
      label: "New Page",
      href: `/studio/lang/${language.slug}/grammar/new`,
      icon: BookOpen,
      color: "violet"
    },
    {
      label: "Write Article",
      href: `/studio/lang/${language.slug}/articles/new`,
      icon: PenLine,
      color: "amber"
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-3xl font-serif tracking-tight mb-1">{language.name}</h1>
        <p className="text-muted-foreground">
          Overview and analytics for your language
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon
          const colorMap = {
            emerald: "hover:border-emerald-500 hover:text-emerald-500",
            violet: "hover:border-violet-500 hover:text-violet-500",
            amber: "hover:border-amber-500 hover:text-amber-500",
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

      {warnings.length > 0 && (
        <ValidationWarnings warnings={warnings} />
      )}

      {/* Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ActivityChart data={activityHistory} />
        </div>
        <PosDistributionChart data={posData} />
        <CompletenessCard stats={completenessStats} />
      </div>

      {/* Details & Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Language Details */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Language Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <ContextualHelp
                    content="Click to edit. Press Enter to save."
                    variant="icon"
                  />
                </div>
                <InlineLanguageEdit
                  languageId={language.id}
                  field="name"
                  value={language.name}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Slug</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">{language.slug}</code>
                  <CopyButton text={language.slug} message="Copied!" size="sm" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Description</span>
              <InlineLanguageEdit
                languageId={language.id}
                field="description"
                value={language.description || ""}
                maxLength={1000}
              />
            </div>

            <div className="pt-2 flex gap-6 text-sm">
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
              <Activity className="h-4 w-4 text-rose-500" />
              Recent Activity
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

