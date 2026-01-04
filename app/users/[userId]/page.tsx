import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { LanguageCard } from "@/app/browse/components/language-card"
import { User, Languages, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getFollowCounts, getFollowers, getFollowing } from "@/app/actions/follow"
import { ProfileHeader } from "@/components/profile-header"
import { ActivityFeed } from "@/components/activity-feed"
import { Footer } from "@/components/footer"

async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
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

  const followers = followersResult.success ? followersResult.data : []
  const following = followingResult.success ? followingResult.data : []

  const isOwnProfile = session?.user?.id === userId

  return (
    <div className="min-h-screen bg-background pb-20">
      <ProfileHeader user={user} isOwnProfile={isOwnProfile} />

      <div className="container mx-auto px-4 py-12">
        {/* Stats Grid */}
        <div className="mb-12 grid grid-cols-3 divide-x divide-border rounded-xl border bg-card p-4 shadow-sm md:grid-cols-3">
          <div className="flex flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-2xl font-bold text-foreground">{languages.length}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Languages className="h-3.5 w-3.5" />
              Languages
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-2xl font-bold text-foreground">{followCounts.success ? followCounts.followers : 0}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Followers
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-2xl font-bold text-foreground">{followCounts.success ? followCounts.following : 0}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Following
            </span>
          </div>
        </div>

        <Tabs defaultValue="languages" className="space-y-8">
          <div className="flex justify-center md:justify-start">
            <TabsList className="bg-muted/40 p-1">
              <TabsTrigger value="languages" className="px-6">Languages</TabsTrigger>
              <TabsTrigger value="activity" className="px-6">Activity</TabsTrigger>
              <TabsTrigger value="followers" className="px-6">Followers</TabsTrigger>
              <TabsTrigger value="following" className="px-6">Following</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="languages" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {languages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <Languages className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">No public languages</h3>
                <p className="mt-2 text-muted-foreground max-w-sm">
                  {isOwnProfile ? "You haven't published any languages yet." : "This user hasn't created any public languages yet."}
                </p>
                {isOwnProfile && (
                  <Link href="/browse" className="mt-6">
                    <Button variant="outline">Create Language</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {languages.map((language) => (
                  <LanguageCard key={language.id} language={language} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-6">Recent Activity</h3>
              <ActivityFeed userId={userId} />
            </div>
          </TabsContent>

          <TabsContent value="followers" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {followers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">No followers yet</h3>
                <p className="mt-2 text-muted-foreground">
                  {isOwnProfile ? "Share your work to gain followers!" : "Be the first to follow this user."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {followers.map((follower) => (
                  <div key={follower.id} className="flex items-center justify-between rounded-xl border bg-card p-4 transition-all hover:bg-muted/20 hover:border-border/80">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={follower.image || undefined} />
                        <AvatarFallback>{follower.name?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate">{follower.name || "Anonymous"}</span>
                        <span className="text-xs text-muted-foreground truncate">{follower.email}</span>
                      </div>
                    </div>
                    <Link href={`/users/${follower.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="following" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {following.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <User className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">Not following anyone</h3>
                <p className="mt-2 text-muted-foreground">
                  {isOwnProfile ? "Explore the community to find creators to follow!" : "This user isn't following anyone yet."}
                </p>
                {isOwnProfile && (
                  <Link href="/browse" className="mt-6">
                    <Button variant="outline">Browse Users</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {following.map((followed) => (
                  <div key={followed.id} className="flex items-center justify-between rounded-xl border bg-card p-4 transition-all hover:bg-muted/20 hover:border-border/80">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={followed.image || undefined} />
                        <AvatarFallback>{followed.name?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate">{followed.name || "Anonymous"}</span>
                        <span className="text-xs text-muted-foreground truncate">{followed.email}</span>
                      </div>
                    </div>
                    <Link href={`/users/${followed.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  )
}


