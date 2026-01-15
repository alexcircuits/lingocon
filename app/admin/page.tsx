import { Suspense } from "react"
import {
    Users,
    Languages,
    BookOpen,
    FileText,
    Activity,
    TrendingUp,
    BarChart3,
    Trophy,
    PieChart
} from "lucide-react"
import { StatCard } from "@/components/admin/stat-card"
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

    // Simple bar representation
    const maxSignups = Math.max(...growth.map(d => d.signups), 1)

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    User Signups (14 Days)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-1 h-32">
                    {growth.map((day, i) => (
                        <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1 group relative"
                        >
                            <div
                                className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/50"
                                style={{
                                    height: `${(day.signups / maxSignups) * 100}%`,
                                    minHeight: day.signups > 0 ? "4px" : "0"
                                }}
                            />
                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                {day.signups} signups on {day.date}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {i % 2 === 0 ? day.date.split(" ")[1] : ""}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

async function ContentGrowthChart() {
    const growth = await getContentGrowth(14)

    // Normalize logic for visualization
    const maxVal = Math.max(...growth.map(d => Math.max(d.languages, d.entries)), 1)

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Content Growth (14 Days)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-1 h-32">
                    {growth.map((day, i) => (
                        <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1 group relative"
                        >
                            <div className="w-full flex gap-0.5 items-end justify-center h-full">
                                <div
                                    className="w-1/2 bg-blue-500/20 hover:bg-blue-500/40 rounded-t transition-colors"
                                    style={{ height: `${(day.languages / maxVal) * 100}%`, minHeight: day.languages > 0 ? "2px" : "0" }}
                                />
                                <div
                                    className="w-1/2 bg-green-500/20 hover:bg-green-500/40 rounded-t transition-colors"
                                    style={{ height: `${(day.entries / maxVal) * 100}%`, minHeight: day.entries > 0 ? "2px" : "0" }}
                                />
                            </div>

                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                <div className="font-medium text-xs border-b border-border/50 mb-1 pb-1">{day.date}</div>
                                <div className="flex gap-2 items-center"><div className="w-2 h-2 bg-blue-500/50 rounded-full" /> {day.languages} Langs</div>
                                <div className="flex gap-2 items-center"><div className="w-2 h-2 bg-green-500/50 rounded-full" /> {day.entries} Entries</div>
                            </div>

                            <span className="text-[10px] text-muted-foreground">
                                {i % 2 === 0 ? day.date.split(" ")[1] : ""}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="w-2 h-2 bg-blue-500/50 rounded-full" /> Languages
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="w-2 h-2 bg-green-500/50 rounded-full" /> Entries
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

async function ActivityBreakdownChart() {
    const { byEntityType } = await getActivityBreakdown(30)

    // Sort by value desc
    const sortedDetails = [...byEntityType].sort((a, b) => b.value - a.value).slice(0, 5)
    const maxVal = Math.max(...sortedDetails.map(d => d.value), 1)

    return (
        <Card className="col-span-full lg:col-span-1">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-primary" />
                    Activity Breakdown (30 Days)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {sortedDetails.map((item) => (
                        <div key={item.name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium capitalize">{item.name}s</span>
                                <span className="text-muted-foreground">{item.value}</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary/50 rounded-full"
                                    style={{ width: `${(item.value / maxVal) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                    {sortedDetails.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No recent activity
                        </p>
                    )}
                </div>
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
        <div className="p-8 space-y-8">
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

