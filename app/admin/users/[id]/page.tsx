import { requireAdmin } from "@/lib/admin"
import { notFound } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ArrowLeft,
    Languages,
    BookOpen,
    FileText,
    Activity,
    ExternalLink
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { getUserDetails } from "@/app/actions/admin-analytics"
import { UserRoleToggle } from "@/components/admin/user-role-toggle"

export const dynamic = "force-dynamic"

export default async function AdminUserDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    // Check admin first
    await requireAdmin()

    const { id } = await params
    const user = await getUserDetails(id)

    if (!user) {
        notFound()
    }

    return (
        <div className="p-8">
            {/* Back Link */}
            <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Users
            </Link>

            {/* User Header */}
            <div className="flex items-start gap-6 mb-8">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-2xl">
                        {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-serif">{user.name || "Unknown"}</h1>
                        {user.isAdmin && (
                            <Badge variant="secondary">Admin</Badge>
                        )}
                        <div className="ml-auto">
                            <UserRoleToggle
                                userId={user.id}
                                isAdmin={user.isAdmin}
                            />
                        </div>
                    </div>
                    <p className="text-muted-foreground">{user.email}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Joined {format(new Date(user.createdAt), "MMMM d, yyyy")}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Languages className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-serif">{user.languages.length}</p>
                                <p className="text-sm text-muted-foreground">Languages</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-violet-500/10">
                                <Activity className="h-4 w-4 text-violet-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-serif">{user._count.activities}</p>
                                <p className="text-sm text-muted-foreground">Activities</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <FileText className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-serif">{user._count.articles}</p>
                                <p className="text-sm text-muted-foreground">Articles</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-rose-500/10">
                                <BookOpen className="h-4 w-4 text-rose-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-serif">{user._count.texts}</p>
                                <p className="text-sm text-muted-foreground">Texts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Languages */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <Languages className="h-4 w-4 text-primary" />
                        Languages ({user.languages.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {user.languages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            This user hasn&apos;t created any languages yet.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {user.languages.map((lang) => (
                                <div
                                    key={lang.id}
                                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-border transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{lang.name}</p>
                                            <Badge
                                                variant={lang.visibility === "PUBLIC" ? "default" : "secondary"}
                                                className="text-xs"
                                            >
                                                {lang.visibility.toLowerCase()}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {lang.entries} entries · {lang.grammarPages} pages
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/lang/${lang.slug}`}
                                            target="_blank"
                                            className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

