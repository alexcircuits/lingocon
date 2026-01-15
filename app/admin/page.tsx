import { Suspense } from "react"
import {
    Users,
    Languages,
    BookOpen,
    FileText,
    Activity,
    TrendingUp
} from "lucide-react"
import { StatCard } from "@/components/admin/stat-card"
import { getPlatformOverview, getRecentSignups, getUserGrowth } from "@/app/actions/admin-analytics"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

async function DashboardStats() {
    const stats = await getPlatformOverview()

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Total Users"
                value={stats.totalUsers}
                icon={Users}
                trend={{ value: stats.growth.users, label: "this week" }}
            />
            <StatCard
                title="Languages"
                value={stats.totalLanguages}
                description={`${stats.publicLanguages} public, ${stats.privateLanguages} private`}
                icon={Languages}
                trend={{ value: stats.growth.languages, label: "this week" }}
            />
            <StatCard
                title="Dictionary Entries"
                value={stats.totalEntries.toLocaleString()}
                icon={BookOpen}
                trend={{ value: stats.growth.entries, label: "this week" }}
            />
            <StatCard
                title="Total Activities"
                value={stats.totalActivities.toLocaleString()}
                description={`${stats.totalGrammarPages} pages, ${stats.totalParadigms} paradigms`}
                icon={Activity}
            />
        </div>
    )
}

async function RecentSignups() {
    const signups = await getRecentSignups(5)

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Recent Signups
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {signups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No recent signups
                        </p>
                    ) : (
                        signups.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.image || undefined} />
                                    <AvatarFallback className="text-xs">
                                        {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {user.email}
                                    </p>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {format(new Date(user.createdAt), "MMM d")}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

async function ActivityChart() {
    const growth = await getUserGrowth(14)

    // Simple bar representation
    const maxSignups = Math.max(...growth.map(d => d.signups), 1)

    return (
        <Card className="col-span-full lg:col-span-2">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    User Signups (Last 14 Days)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-1 h-32">
                    {growth.map((day, i) => (
                        <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1"
                        >
                            <div
                                className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/30"
                                style={{
                                    height: `${(day.signups / maxSignups) * 100}%`,
                                    minHeight: day.signups > 0 ? "4px" : "0"
                                }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                                {day.date.split(" ")[1]}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

function LoadingSkeleton() {
    return (
        <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-muted rounded-xl" />
                ))}
            </div>
        </div>
    )
}

export default function AdminDashboardPage() {
    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">Admin Dashboard</h1>
                <p className="text-muted-foreground">
                    Platform overview and key metrics
                </p>
            </div>

            {/* Stats Grid */}
            <Suspense fallback={<LoadingSkeleton />}>
                <DashboardStats />
            </Suspense>

            {/* Charts and Lists */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Suspense fallback={<div className="h-48 bg-muted rounded-xl animate-pulse lg:col-span-2" />}>
                    <ActivityChart />
                </Suspense>
                <Suspense fallback={<div className="h-48 bg-muted rounded-xl animate-pulse" />}>
                    <RecentSignups />
                </Suspense>
            </div>
        </div>
    )
}
