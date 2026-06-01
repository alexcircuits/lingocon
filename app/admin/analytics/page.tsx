"use client"

import { useEffect, useState, useCallback } from "react"
import {
    Users,
    Languages,
    Activity,
    TrendingUp,
    Heart,
    BookOpen,
    RefreshCw
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    getUserGrowth,
    getContentGrowth,
    getActivityBreakdown,
    getMostActiveUsers,
    getTopLanguages
} from "@/app/actions/admin-analytics"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
    TrendAreaChart,
    GroupedBarChart,
    CategoryDonutChart,
    RankedBarChart,
    CHART_COLORS
} from "@/components/admin/charts"

type GrowthPoint = {
    date: string
    fullDate: string
    signups: number
}

type ContentPoint = {
    date: string
    fullDate: string
    languages: number
    entries: number
}

type CategoryItem = {
    name: string
    value: number
}

type ActiveUser = {
    id: string
    name: string
    image: string | null
    activities: number
    languages: number
}

type TopLanguage = {
    id: string
    name: string
    owner: string | null
    favorites: number
    entries: number
}

const RANGE_OPTIONS = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 }
]

export default function AdminAnalyticsPage() {
    const [days, setDays] = useState(30)
    const [userGrowth, setUserGrowth] = useState<GrowthPoint[]>([])
    const [contentGrowth, setContentGrowth] = useState<ContentPoint[]>([])
    const [activityBreakdown, setActivityBreakdown] = useState<CategoryItem[]>([])
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
    const [topLanguages, setTopLanguages] = useState<TopLanguage[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const loadData = useCallback(async (rangeDays: number) => {
        const [growth, content, activity, users, languages] = await Promise.all([
            getUserGrowth(rangeDays),
            getContentGrowth(rangeDays),
            getActivityBreakdown(rangeDays),
            getMostActiveUsers(5),
            getTopLanguages(8)
        ])
        setUserGrowth(growth)
        setContentGrowth(content)
        setActivityBreakdown(
            [...activity.byEntityType].sort((a, b) => b.value - a.value)
        )
        setActiveUsers(users)
        setTopLanguages(languages)
    }, [])

    useEffect(() => {
        let active = true
        setRefreshing(true)
        loadData(days)
            .catch((error) => console.error("Failed to load analytics:", error))
            .finally(() => {
                if (active) {
                    setLoading(false)
                    setRefreshing(false)
                }
            })
        return () => {
            active = false
        }
    }, [days, loadData])

    const totalSignups = userGrowth.reduce((sum, d) => sum + d.signups, 0)
    const totalLanguagesCreated = contentGrowth.reduce((sum, d) => sum + d.languages, 0)
    const totalEntriesCreated = contentGrowth.reduce((sum, d) => sum + d.entries, 0)
    const totalActivity = activityBreakdown.reduce((sum, d) => sum + d.value, 0)

    const topLanguageChartData = topLanguages
        .slice()
        .sort((a, b) => b.favorites - a.favorites)
        .map((l) => ({ name: l.name, favorites: l.favorites }))

    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-serif mb-2">Analytics</h1>
                    <p className="text-muted-foreground">
                        Platform usage and growth metrics
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {refreshing && (
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <div className="inline-flex rounded-lg border border-border bg-card p-1">
                        {RANGE_OPTIONS.map((opt) => (
                            <button
                                key={opt.days}
                                onClick={() => setDays(opt.days)}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                    days === opt.days
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryStat icon={Users} label="New signups" value={totalSignups} />
                        <SummaryStat icon={Languages} label="Languages created" value={totalLanguagesCreated} />
                        <SummaryStat icon={BookOpen} label="Entries created" value={totalEntriesCreated} />
                        <SummaryStat icon={Activity} label="Activity events" value={totalActivity} />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* User Growth Chart */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    User Signups
                                </CardTitle>
                                <CardDescription>Daily new accounts</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <TrendAreaChart data={userGrowth} dataKey="signups" name="Signups" />
                            </CardContent>
                        </Card>

                        {/* Content Growth Chart */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <Languages className="h-4 w-4 text-primary" />
                                    Content Growth
                                </CardTitle>
                                <CardDescription>Languages &amp; dictionary entries</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <GroupedBarChart
                                    data={contentGrowth}
                                    series={[
                                        { key: "languages", name: "Languages", color: CHART_COLORS[0] },
                                        { key: "entries", name: "Entries", color: CHART_COLORS[1] }
                                    ]}
                                />
                            </CardContent>
                        </Card>

                        {/* Activity Breakdown Donut */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-primary" />
                                    Activity by Content Type
                                </CardTitle>
                                <CardDescription>Share of edits across the platform</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CategoryDonutChart data={activityBreakdown} />
                            </CardContent>
                        </Card>

                        {/* Top Languages bar chart */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <Heart className="h-4 w-4 text-primary" />
                                    Top Languages by Favorites
                                </CardTitle>
                                <CardDescription>Most-favorited languages</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RankedBarChart
                                    data={topLanguageChartData}
                                    dataKey="favorites"
                                    color={CHART_COLORS[1]}
                                    emptyMessage="No favorited languages yet"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Most Active Users */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Most Active Users
                            </CardTitle>
                            <CardDescription>Ranked by total activity events</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                {activeUsers.map((user, i) => (
                                    <div key={user.id} className="flex items-center gap-3">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                                            {i + 1}
                                        </span>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.image || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {user.name?.charAt(0) || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{user.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {user.activities} activities · {user.languages} languages
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {activeUsers.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4 md:col-span-2">
                                        No activity data
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}

function SummaryStat({
    icon: Icon,
    label,
    value
}: {
    icon: typeof Users
    label: string
    value: number
}) {
    return (
        <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-serif font-medium tabular-nums">
                {value.toLocaleString()}
            </p>
        </div>
    )
}
