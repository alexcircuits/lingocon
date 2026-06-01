import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Languages, Type, Library, Plus, Calendar, ArrowRight, Sparkles } from "lucide-react"
import { AnimatedLanguageCard } from "./components/animated-language-card"
import { LanguageImportDialog } from "@/components/language-import-dialog"
import { ActivityFeed } from "@/components/activity-feed"
import { getRecentActivitiesForUserLanguages } from "@/lib/utils/activity"
import { getNextBadges } from "@/app/actions/badge"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BadgeProgress } from "@/components/badges"
import { cn } from "@/lib/utils"
import { DashboardTour } from "@/components/onboarding/dashboard-tour"
import { SupportWidget } from "@/components/support-widget"


export const metadata = {
  title: "Dashboard",
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = "force-dynamic"


function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

async function getLanguages(userId: string) {
  return prisma.language.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId: userId } } }
      ]
    },
    include: {
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  })
}

const statCards = [
  { key: "totalLanguages", label: "Languages", icon: Languages },
  { key: "totalSymbols", label: "Script Symbols", icon: Type },
  { key: "totalPages", label: "Grammar Pages", icon: BookOpen },
  { key: "totalEntries", label: "Dictionary Entries", icon: Library },
] as const

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const userId = session?.user?.id || (await getDevUserId())
  const languages = await getLanguages(userId)
  const stats = {
    totalLanguages: languages.length,
    totalSymbols: languages.reduce((sum, lang) => sum + lang._count.scriptSymbols, 0),
    totalPages: languages.reduce((sum, lang) => sum + lang._count.grammarPages, 0),
    totalEntries: languages.reduce((sum, lang) => sum + lang._count.dictionaryEntries, 0),
  }
  const activities = userId ? await getRecentActivitiesForUserLanguages(userId, 10) : []
  const nextBadges = userId ? await getNextBadges(userId) : []

  // Fetch isAdmin status from database
  const dbUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true }
  }) : null

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    isAdmin: dbUser?.isAdmin || false,
  } : null

  const greeting = getGreeting()
  const userName = user?.name?.split(" ")[0] || "there"
  const mostRecent = languages[0]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardTour />

      <Navbar user={user} isDevMode={isDevMode} />

      <div className="h-14" />

      <main className="container mx-auto px-4 py-6 sm:py-8 md:py-10 max-w-6xl">
        {/* Hero Greeting */}
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-border/50 bg-card/50 p-6 sm:mb-10 sm:p-8 md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{greeting},</p>
              <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                {userName}
              </h1>
              <p className="mt-3 max-w-md text-muted-foreground">
                {languages.length === 0
                  ? "Ready to start building your first constructed language?"
                  : `You have ${languages.length} ${languages.length === 1 ? "language" : "languages"} in your workspace.`}
              </p>
              {mostRecent && (
                <Link
                  href={`/studio/lang/${mostRecent.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all hover:gap-2.5"
                >
                  Continue editing {mostRecent.name}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
              <LanguageImportDialog className="w-full sm:w-auto" />
              <Link href="/dashboard/new-language" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  <Plus className="h-4 w-4" />
                  New Language
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats - 2-col grid on mobile, inline pills on desktop */}
        {languages.length > 0 && (
          <section className="mb-8 sm:mb-10">
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              {statCards.map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  className="inline-flex w-full items-center gap-2.5 rounded-2xl border border-border/60 bg-card/60 py-2 pl-2.5 pr-4 transition-colors hover:border-primary/40 sm:w-auto sm:rounded-full"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-lg font-bold tabular-nums leading-none">
                    {stats[key as keyof typeof stats]}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main content. On mobile: Activity → Languages → Achievements → Support.
            On desktop: Languages spans the left column; sidebar stacks on the right. */}
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            "[grid-template-areas:'activity'_'languages'_'achievements'_'support']",
            "lg:grid-cols-[1.7fr_1fr] lg:gap-8 lg:items-start",
            "lg:[grid-template-areas:'languages_activity'_'languages_achievements'_'languages_support']",
          )}
        >
          {/* Languages */}
          <section className="space-y-4 [grid-area:languages]">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <Languages className="h-4 w-4 text-primary" />
                Your Languages
              </h2>
              <div className="flex items-center gap-4">
                {languages.length > 1 && (
                  <Link href="/dashboard/families" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    Family tree →
                  </Link>
                )}
                {languages.length > 0 && (
                  <Link href="/browse" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    Browse all →
                  </Link>
                )}
              </div>
            </div>

            {languages.length === 0 ? (
              <Card className="border-dashed">
                <CardHeader className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg font-bold">Start your first language</CardTitle>
                  <CardDescription className="mx-auto mt-2 max-w-xs">
                    Create a structured home for your conlang with dictionary, grammar wiki, and more.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-12">
                  <Link href="/dashboard/new-language">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Language
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {languages.map((language, index) => (
                  <AnimatedLanguageCard key={language.id} language={language} index={index} />
                ))}
              </div>
            )}
          </section>

          {/* Recent Activity */}
          <section className="space-y-4 [grid-area:activity]">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <Calendar className="h-4 w-4 text-primary" />
                Recent Activity
              </h2>
              <Link href="/dashboard/feed" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                View feed →
              </Link>
            </div>
            <div className="min-h-[200px] rounded-2xl border border-border/50 bg-card p-4 lg:min-h-[280px]">
              {activities.length > 0 ? (
                <ActivityFeed activities={activities} showLanguage={true} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Calendar className="mb-3 h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="mt-1 text-xs">Your changes will appear here</p>
                </div>
              )}
            </div>
          </section>

          {/* Achievements */}
          {nextBadges.length > 0 && (
            <section className="[grid-area:achievements]">
              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <BadgeProgress badges={nextBadges} />
                <div className="mt-4 border-t border-border/40 pt-3 text-center">
                  <Link
                    href={`/users/${userId}?tab=badges`}
                    className="text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    View all achievements
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Support */}
          <div className="[grid-area:support]">
            <SupportWidget />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
