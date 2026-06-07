import { auth } from "@/auth"
import { getDevUserId } from "@/lib/dev-auth"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { ActivityFeed } from "@/components/activity-feed"
import { getFeedActivitiesForUser } from "@/lib/utils/activity"
import { Navbar } from "@/components/navbar"
import { Users } from "lucide-react"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feed")
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  }
}

export default async function FeedPage() {
  const session = await auth()
  
  if (!session?.user?.id && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }
  
  const userId = session?.user?.id || (await getDevUserId())
  if (!userId) redirect("/login")
  
  const activities = await getFeedActivitiesForUser(userId, 50)
  const isDevMode = process.env.DEV_MODE === "true"
  const t = await getTranslations("feed")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar user={session?.user as any} isDevMode={isDevMode} />

      <div className="h-14" />

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h1 className="text-3xl font-serif tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>

        {activities.length > 0 ? (
           <ActivityFeed activities={activities as any} showLanguage={true} mode="feed" userId={userId} />
        ) : (
          <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border flex flex-col items-center justify-center">
            <div className="p-4 bg-muted/50 rounded-full mb-4">
              <Users className="h-10 w-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-serif mb-2">{t("emptyTitle")}</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">{t("emptyDesc")}</p>
          </div>
        )}
      </main>
    </div>
  )
}
