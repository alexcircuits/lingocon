import { Suspense } from "react"
import {
    Users,
    Languages,
    BookOpen,
    Activity,
    TrendingUp,
    BarChart3,
    Trophy,
    PieChart
} from "lucide-react"
import { StatCard } from "@/components/admin/stat-card"
import {
    TrendAreaChart,
    GroupedBarChart,
    CategoryDonutChart,
    CHART_COLORS
} from "@/components/admin/charts"
import {
    getPlatformOverview,
    getRecentSignups,
    getUserGrowth,
    getContentGrowth,
    getTopLanguages,
    getActivityBreakdown
} from "@/app/actions/admin-analytics"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

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
                            <Link
                                href={`/admin/users/${user.id}`}
                                key={user.id}
                                className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
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
                            </Link>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

async function ActivityChart() {
    const growth = await getUserGrowth(14)

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    User Signups
                </CardTitle>
                <CardDescription>New accounts over the last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
                <TrendAreaChart
                    data={growth}
                    dataKey="signups"
                    name="Signups"
                    height={208}
                    emptyMessage="No signups in this period"
                />
            </CardContent>
        </Card>
    )
}

async function ContentGrowthChart() {
    const growth = await getContentGrowth(14)

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Content Growth
                </CardTitle>
                <CardDescription>Languages &amp; entries created over 14 days</CardDescription>
            </CardHeader>
            <CardContent>
                <GroupedBarChart
                    data={growth}
                    height={208}
                    series={[
                        { key: "languages", name: "Languages", color: CHART_COLORS[0] },
                        { key: "entries", name: "Entries", color: CHART_COLORS[1] }
                    ]}
                    emptyMessage="No content created in this period"
                />
            </CardContent>
        </Card>
    )
}

async function ActivityBreakdownChart() {
    const { byEntityType } = await getActivityBreakdown(30)

    const data = [...byEntityType]
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
        .map((item) => ({ name: item.name, value: item.value }))

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-primary" />
                    Activity Breakdown
                </CardTitle>
                <CardDescription>By content type, last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
                <CategoryDonutChart data={data} height={208} />
            </CardContent>
        </Card>
    )
}

async function TopLanguagesTable() {
    const languages = await getTopLanguages(5)

    return (
        <Card className="col-span-full lg:col-span-2">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Top Languages
                </CardTitle>
                <CardDescription>Most active languages by content and favorites</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    {languages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No languages found
                        </p>
                    ) : (
                        languages.map((lang, i) => (
                            <Link
                                key={lang.id}
                                href={`/admin/languages/${lang.id}`}
                                className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded-lg -mx-2 transition-colors text-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                                        {i + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{lang.name}</span>
                                        <span className="text-xs text-muted-foreground">by {lang.owner}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="font-normal">
                                        {lang.visibility.toLowerCase()}
                                    </Badge>
                                    <div title="Entries">
                                        <BookOpen className="h-3 w-3 inline mr-1" />
                                        {lang.entries}
                                    </div>
                                    <div title="Favorites">
                                        <TrendingUp className="h-3 w-3 inline mr-1" />
                                        {lang.favorites}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-64">
                <div className="bg-muted rounded-xl lg:col-span-2" />
                <div className="bg-muted rounded-xl" />
            </div>
        </div>
    )
}

export default function AdminDashboardPage() {
    return (
        <div className="p-4 md:p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-serif mb-2">Admin Dashboard</h1>
                <p className="text-muted-foreground">
                    Platform overview and key metrics
                </p>
            </div>

            {/* Stats Grid */}
            <Suspense fallback={<LoadingSkeleton />}>
                <DashboardStats />
            </Suspense>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
                    <ActivityChart />
                </Suspense>
                <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
                    <ContentGrowthChart />
                </Suspense>
                <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
                    <ActivityBreakdownChart />
                </Suspense>
            </div>

            {/* Lists Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse lg:col-span-2" />}>
                    <TopLanguagesTable />
                </Suspense>
                <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
                    <RecentSignups />
                </Suspense>
            </div>
        </div>
    )
}

