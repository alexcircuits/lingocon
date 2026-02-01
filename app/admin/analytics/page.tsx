"use client"

import { useEffect, useState } from "react"
import {
    BarChart3,
    Users,
    Languages,
    Activity,
    TrendingUp
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    getUserGrowth,
    getContentGrowth,
    getActivityBreakdown,
    getMostActiveUsers,
    getTopLanguages
} from "@/app/actions/admin-analytics"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts"

const COLORS = ["#0ea5a0", "#f97316", "#8b5cf6", "#22c55e", "#ef4444", "#3b82f6"]

export default function AdminAnalyticsPage() {
    const [userGrowth, setUserGrowth] = useState<any[]>([])
    const [contentGrowth, setContentGrowth] = useState<any[]>([])
    const [activityBreakdown, setActivityBreakdown] = useState<{ byEntityType: any[]; byActionType: any[] }>({ byEntityType: [], byActionType: [] })
    const [activeUsers, setActiveUsers] = useState<any[]>([])
    const [topLanguages, setTopLanguages] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const [growth, content, activity, users, languages] = await Promise.all([
                    getUserGrowth(30),
                    getContentGrowth(30),
                    getActivityBreakdown(30),
                    getMostActiveUsers(5),
                    getTopLanguages(5)
                ])
                setUserGrowth(growth)
                setContentGrowth(content)
                setActivityBreakdown(activity)
                setActiveUsers(users)
                setTopLanguages(languages)
            } catch (error) {
                console.error("Failed to load analytics:", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    if (loading) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-serif mb-8">Analytics</h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">Analytics</h1>
                <p className="text-muted-foreground">
                    Platform usage and growth metrics
                </p>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Growth Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            User Signups (30 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={userGrowth}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => v.split(" ")[1]}
                                    />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px"
                                        }}
                                    />
                                    <Bar dataKey="signups" fill="hsl(175, 60%, 35%)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Content Growth Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Languages className="h-4 w-4 text-primary" />
                            Content Growth (30 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={contentGrowth}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => v.split(" ")[1]}
                                    />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px"
                                        }}
                                    />
                                    <Bar dataKey="languages" fill="hsl(175, 60%, 35%)" name="Languages" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="entries" fill="hsl(15, 80%, 55%)" name="Entries" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Activity Breakdown Pie */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Activity by Content Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activityBreakdown.byEntityType}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name }) => name}
                                    >
                                        {activityBreakdown.byEntityType.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px"
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Most Active Users */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Most Active Users
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {activeUsers.map((user, i) => (
                                <div key={user.id} className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-muted-foreground w-4">
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
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No activity data
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Languages */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Top Languages by Favorites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {topLanguages.map((lang, i) => (
                                <div
                                    key={lang.id}
                                    className="p-4 rounded-lg border border-border/50 bg-muted/30"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg font-serif">#{i + 1}</span>
                                        <span className="font-medium truncate">{lang.name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        by {lang.owner}
                                    </p>
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        <span className="text-foreground font-medium">{lang.favorites}</span> favorites ·{" "}
                                        <span className="text-foreground font-medium">{lang.entries}</span> entries
                                    </div>
                                </div>
                            ))}
                            {topLanguages.length === 0 && (
                                <p className="text-sm text-muted-foreground col-span-5 text-center py-8">
                                    No languages with favorites yet
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
