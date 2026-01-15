import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Server,
    Database,
    HardDrive,
    Bell,
    CheckCircle,
    AlertCircle,
    Megaphone
} from "lucide-react"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

async function getSystemStatus() {
    await requireAdmin()

    // Check database connection
    let dbStatus = "connected"
    try {
        await prisma.$queryRaw`SELECT 1`
    } catch {
        dbStatus = "error"
    }

    // Get table counts for storage estimate
    const [users, languages, entries, activities, updates] = await Promise.all([
        prisma.user.count(),
        prisma.language.count(),
        prisma.dictionaryEntry.count(),
        prisma.activity.count(),
        prisma.platformUpdate.findMany({
            orderBy: { createdAt: "desc" },
            take: 5
        })
    ])

    return {
        database: {
            status: dbStatus,
            tables: {
                users,
                languages,
                entries,
                activities
            }
        },
        platformUpdates: updates
    }
}

export default async function AdminSystemPage() {
    const status = await getSystemStatus()

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">System</h1>
                <p className="text-muted-foreground">
                    System health and platform settings
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Database Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            Database Status
                        </CardTitle>
                        <CardDescription>PostgreSQL connection status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 mb-6">
                            {status.database.status === "connected" ? (
                                <>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    <span className="font-medium text-green-600">Connected</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                    <span className="font-medium text-red-600">Connection Error</span>
                                </>
                            )}
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Users</span>
                                <span className="font-medium">{status.database.tables.users.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Languages</span>
                                <span className="font-medium">{status.database.tables.languages.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Dictionary Entries</span>
                                <span className="font-medium">{status.database.tables.entries.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Activity Logs</span>
                                <span className="font-medium">{status.database.tables.activities.toLocaleString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Server Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Server className="h-4 w-4 text-primary" />
                            Server Information
                        </CardTitle>
                        <CardDescription>Runtime environment details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Node.js Version</span>
                                <span className="font-mono text-xs">{process.version}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Environment</span>
                                <Badge variant={process.env.NODE_ENV === "production" ? "default" : "secondary"}>
                                    {process.env.NODE_ENV}
                                </Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Platform</span>
                                <span className="font-mono text-xs">{process.platform}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Platform Updates */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-primary" />
                            Recent Platform Updates
                        </CardTitle>
                        <CardDescription>
                            Latest announcements shown to users
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {status.platformUpdates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No platform updates yet
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {status.platformUpdates.map((update) => (
                                    <div
                                        key={update.id}
                                        className="flex items-start gap-3 p-4 rounded-lg border border-border/50"
                                    >
                                        <Bell className="h-4 w-4 text-muted-foreground mt-1" />
                                        <div className="flex-1">
                                            <p className="font-medium">{update.title}</p>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                {update.description}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {format(new Date(update.createdAt), "MMMM d, yyyy")}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
