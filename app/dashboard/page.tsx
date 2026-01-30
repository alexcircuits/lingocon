import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Languages, FileText, Plus, Calendar, ArrowRight, Sparkles } from "lucide-react"
import { AnimatedLanguageCard } from "./components/animated-language-card"
import { LanguageImportDialog } from "@/components/language-import-dialog"
import { ActivityFeed } from "@/components/activity-feed"
import { getRecentActivitiesForUserLanguages } from "@/lib/utils/activity"
import { getNextBadges } from "@/app/actions/badge"
import { Navbar } from "@/components/navbar"
import { BadgeProgress } from "@/components/badges"
import { cn } from "@/lib/utils"
import { DashboardTour } from "@/components/onboarding/dashboard-tour"


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
      ownerId: userId,
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

async function getStats(userId: string) {
  const languages = await prisma.language.findMany({
    where: { ownerId: userId },
    include: {
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
        },
      },
    },
  })

  return {
    totalLanguages: languages.length,
    totalSymbols: languages.reduce((sum, lang) => sum + lang._count.scriptSymbols, 0),
    totalPages: languages.reduce((sum, lang) => sum + lang._count.grammarPages, 0),
    totalEntries: languages.reduce((sum, lang) => sum + lang._count.dictionaryEntries, 0),
  }
}

const statCards = [
  { key: "totalLanguages", label: "Languages", icon: Languages, color: "text-primary", bgColor: "bg-primary/10" },
  { key: "totalSymbols", label: "Script Symbols", icon: FileText, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  { key: "totalPages", label: "Grammar Pages", icon: BookOpen, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { key: "totalEntries", label: "Dictionary Entries", icon: FileText, color: "text-rose-500", bgColor: "bg-rose-500/10" },
]

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const userId = session?.user?.id || (await getDevUserId())
  const languages = await getLanguages(userId)
  const stats = await getStats(userId)
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardTour />

      <Navbar user={user} isDevMode={isDevMode} />

      <div className="h-14" />

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
        {/* Hero Greeting */}
        <section className="mb-12 pb-8 border-b border-border/40">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-1">{greeting}</p>
              <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-3">
                {userName}
              </h1>
              <p className="text-muted-foreground max-w-md">
                {languages.length === 0
                  ? "Ready to start building your first constructed language?"
                  : `You have ${languages.length} ${languages.length === 1 ? "language" : "languages"} in your workspace.`
                }
              </p>
            </div>
            <div className="flex gap-3">
              <LanguageImportDialog />
              <Link href="/dashboard/new-language">
                <Button size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Language
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Grid - Only show if user has languages */}
        {languages.length > 0 && (
          <section className="mb-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {statCards.map(({ key, label, icon: Icon, color, bgColor }) => (
                <div
                  key={key}
                  className="group p-4 md:p-5 rounded-xl bg-card border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("p-2 rounded-lg", bgColor)}>
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-serif font-medium tracking-tight">
                    {stats[key as keyof typeof stats]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Languages Section */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" />
                Your Languages
              </h2>
              {languages.length > 0 && (
                <Link href="/browse" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Browse all →
                </Link>
              )}
            </div>

            {languages.length === 0 ? (
              <Card className="border-dashed">
                <CardHeader className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg font-serif">Start your first language</CardTitle>
                  <CardDescription className="max-w-xs mx-auto mt-2">
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
                  <AnimatedLanguageCard
                    key={language.id}
                    language={language}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Sidebar */}
          <div className="space-y-6">
            {/* Achievements Progress */}
            {nextBadges.length > 0 && (
              <div className="bg-card border border-border/50 rounded-xl p-4">
                <BadgeProgress badges={nextBadges} />
                <div className="mt-4 pt-3 border-t border-border/40 text-center">
                  <Link href={`/users/${userId}?tab=badges`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    View all achievements
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-500" />
                Recent Activity
              </h2>
              <div className="bg-card border border-border/50 rounded-xl p-4 min-h-[280px]">
                {activities.length > 0 ? (
                  <ActivityFeed activities={activities} showLanguage={true} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                    <Calendar className="h-8 w-8 mb-3 opacity-30" />
                    <p className="text-sm font-medium">No activity yet</p>
                    <p className="text-xs mt-1">Your changes will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
