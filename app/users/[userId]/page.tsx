import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { User, Medal, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getFollowCounts, getFollowers, getFollowing } from "@/app/actions/follow"
import { getUserBadges } from "@/app/actions/badge"
import { ActivityFeed } from "@/components/activity-feed"
import { Footer } from "@/components/footer"
import { BadgeGrid } from "@/components/badges"

// New Components
import { ProfileCover } from "@/components/profile/profile-cover"
import { ProfileSidebar } from "@/components/profile/profile-sidebar"
import { LanguageList } from "@/components/profile/language-list"
import { BackButton } from "@/components/back-button"

async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
    },
  })
  return user
}

async function getUserLanguages(userId: string) {
  const languages = await prisma.language.findMany({
    where: {
      ownerId: userId,
      visibility: "PUBLIC",
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
        },
      },
      scriptSymbols: { take: 0 }, // Hack to satisfy types if needed, or arguably just select all and letting Prismic infer
      // actually LanguageCard needs specific fields. Let's just grab everything to be safe and simple since LanguageCard expects the full model
    },
    orderBy: {
      updatedAt: "desc",
    },
  })
  return languages
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const session = await auth()
  const user = await getUser(userId)

  if (!user) {
    notFound()
  }

  const languages = await getUserLanguages(userId)
  const followCounts = await getFollowCounts(userId)
  const followersResult = await getFollowers(userId)
  const followingResult = await getFollowing(userId)
  const badges = await getUserBadges(userId)
  const earnedBadgesCount = badges.filter(b => b.isEarned).length

  const followers = followersResult.success ? followersResult.data : []
  const following = followingResult.success ? followingResult.data : []
  const isOwnProfile = session?.user?.id === userId

  const stats = {
    languages: languages.length,
    followers: followCounts.success ? followCounts.followers : 0,
    following: followCounts.success ? followCounts.following : 0,
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <BackButton />
      <ProfileCover />

      <div className="container mx-auto px-4 md:px-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-8 pb-20">

          {/* Left Sidebar - Sticky on Desktop */}
          <aside className="relative">
            <div className="md:sticky md:top-24">
              <ProfileSidebar
                user={user}
                stats={stats}
                isOwnProfile={isOwnProfile}
                badges={badges}
              />
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="mt-8 md:mt-12 min-w-0">
            <Tabs defaultValue="languages" className="space-y-6">
              <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md py-4 -mx-4 px-4 md:-mx-0 md:px-0 md:static md:bg-transparent md:backdrop-blur-none md:p-0">
                <TabsList className="bg-muted/40 p-1 w-full flex justify-start overflow-x-auto no-scrollbar md:w-auto md:inline-flex">
                  <TabsTrigger value="languages" className="flex-1 md:flex-none md:w-32">Languages</TabsTrigger>
                  <TabsTrigger value="badges" className="flex-1 md:flex-none md:gap-1.5 md:px-6">
                    Badges
                    {earnedBadgesCount > 0 && (
                      <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full hidden md:inline-flex">
                        {earnedBadgesCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1 md:flex-none md:w-28">Activity</TabsTrigger>
                  <TabsTrigger value="social" className="flex-1 md:flex-none md:w-28">Network</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="languages" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <LanguageList languages={languages} isOwnProfile={isOwnProfile} />
              </TabsContent>

              <TabsContent value="badges" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Medal className="h-5 w-5 text-primary" />
                      Achievements
                    </h2>
                    <p className="text-muted-foreground text-sm">Track your progress and earnings</p>
                  </div>
                  <BadgeGrid badges={badges} showFilters={true} showProgress={true} />
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="max-w-2xl">
                  <h3 className="text-lg font-semibold mb-6">Recent Activity</h3>
                  <ActivityFeed userId={userId} />
                </div>
              </TabsContent>

              {/* Combined Social Tab for cleaner UI */}
              <TabsContent value="social" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid gap-8">
                  {/* Followers */}
                  <section>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Followers ({stats.followers})
                    </h3>
                    {followers.length === 0 ? (
                      <div className="text-center py-8 border rounded-xl border-dashed bg-muted/20">
                        <p className="text-muted-foreground">No followers yet</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {followers.map((follower) => (
                          <Link key={follower.id} href={`/users/${follower.id}`}>
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={follower.image || undefined} />
                                <AvatarFallback>{follower.name?.[0] || "U"}</AvatarFallback>
                              </Avatar>
                              <div className="overflow-hidden">
                                <p className="font-medium truncate">{follower.name}</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Following */}
                  <section>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Following ({stats.following})
                    </h3>
                    {following.length === 0 ? (
                      <div className="text-center py-8 border rounded-xl border-dashed bg-muted/20">
                        <p className="text-muted-foreground">Not following anyone yet</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {following.map((followed) => (
                          <Link key={followed.id} href={`/users/${followed.id}`}>
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={followed.image || undefined} />
                                <AvatarFallback>{followed.name?.[0] || "U"}</AvatarFallback>
                              </Avatar>
                              <div className="overflow-hidden">
                                <p className="font-medium truncate">{followed.name}</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}
