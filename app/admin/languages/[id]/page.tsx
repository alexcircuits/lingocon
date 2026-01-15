import { requireAdmin } from "@/lib/admin"
import { notFound } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ArrowLeft,
    BookOpen,
    FileText,
    Heart,
    Activity,
    ExternalLink,
    Globe,
    Eye,
    EyeOff,
    Users,
    AlignLeft,
    Type,
    Table2
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { getLanguageDetails } from "@/app/actions/admin-analytics"
import { LanguageVisibilityToggle } from "@/components/admin/language-visibility-toggle"

export const dynamic = "force-dynamic"

const visibilityConfig = {
    PUBLIC: { icon: Globe, label: "Public", color: "bg-green-500/10 text-green-600" },
    UNLISTED: { icon: EyeOff, label: "Unlisted", color: "bg-yellow-500/10 text-yellow-600" },
    PRIVATE: { icon: Eye, label: "Private", color: "bg-gray-500/10 text-gray-600" }
}

export default async function AdminLanguageDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    await requireAdmin()

    const { id } = await params
    const language = await getLanguageDetails(id)

    if (!language) {
        notFound()
    }

    const visibility = visibilityConfig[language.visibility]
    const VisIcon = visibility.icon

    return (
        <div className="p-8">
            {/* Back Link */}
            <Link
                href="/admin/languages"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Languages
            </Link>

            {/* Language Header */}
            <div className="flex items-start gap-6 mb-8">
                <div className={`p-4 rounded-xl ${visibility.color}`}>
                    <VisIcon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-serif">{language.name}</h1>
                        <Badge variant="outline">/{language.slug}</Badge>
                        <div className="ml-auto flex items-center gap-2">
                            <LanguageVisibilityToggle
                                languageId={language.id}
                                currentVisibility={language.visibility}
                            />
                            <Link
                                href={`/lang/${language.slug}`}
                                target="_blank"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink className="h-5 w-5" />
                            </Link>
                        </div>
                    </div>
                    {language.description && (
                        <p className="text-muted-foreground line-clamp-2 mb-2">
                            {language.description}
                        </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                        Created {format(new Date(language.createdAt), "MMMM d, yyyy")}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <BookOpen className="h-5 w-5 text-primary mb-2" />
                            <p className="text-2xl font-serif">{language.stats.dictionaryEntries}</p>
                            <p className="text-xs text-muted-foreground">Entries</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <FileText className="h-5 w-5 text-violet-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.grammarPages}</p>
                            <p className="text-xs text-muted-foreground">Grammar</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <Type className="h-5 w-5 text-emerald-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.scriptSymbols}</p>
                            <p className="text-xs text-muted-foreground">Alphabet</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <Table2 className="h-5 w-5 text-amber-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.paradigms}</p>
                            <p className="text-xs text-muted-foreground">Paradigms</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <AlignLeft className="h-5 w-5 text-blue-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.articles}</p>
                            <p className="text-xs text-muted-foreground">Articles</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <BookOpen className="h-5 w-5 text-rose-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.texts}</p>
                            <p className="text-xs text-muted-foreground">Texts</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <Heart className="h-5 w-5 text-red-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.favorites}</p>
                            <p className="text-xs text-muted-foreground">Favorites</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center">
                            <Activity className="h-5 w-5 text-orange-500 mb-2" />
                            <p className="text-2xl font-serif">{language.stats.activities}</p>
                            <p className="text-xs text-muted-foreground">Activities</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Owner & Collaborators */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Owner & Collaborators
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Owner */}
                            <Link
                                href={`/admin/users/${language.owner.id}`}
                                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors"
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={language.owner.image || undefined} />
                                    <AvatarFallback>
                                        {language.owner.name?.charAt(0) || language.owner.email?.charAt(0) || "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{language.owner.name || "Unknown"}</p>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {language.owner.email}
                                    </p>
                                </div>
                                <Badge>Owner</Badge>
                            </Link>

                            {/* Collaborators */}
                            {language.collaborators.length > 0 ? (
                                language.collaborators.map((collab) => (
                                    <Link
                                        key={collab.id}
                                        href={`/admin/users/${collab.user.id}`}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors"
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={collab.user.image || undefined} />
                                            <AvatarFallback>
                                                {collab.user.name?.charAt(0) || collab.user.email?.charAt(0) || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{collab.user.name || "Unknown"}</p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {collab.user.email}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">{collab.role}</Badge>
                                    </Link>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No collaborators
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Recent Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {language.recentActivity.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No recent activity
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {language.recentActivity.map((activity) => (
                                    <div
                                        key={activity.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border border-border/50"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm">
                                                <span className="font-medium">{activity.user}</span>
                                                {" "}
                                                <span className="text-muted-foreground">
                                                    {activity.type.toLowerCase()}
                                                </span>
                                                {" "}
                                                <span className="capitalize">
                                                    {activity.entityType.toLowerCase().replace("_", " ")}
                                                </span>
                                            </p>
                                            {activity.description && (
                                                <p className="text-xs text-muted-foreground truncate mt-1">
                                                    {activity.description}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {format(new Date(activity.createdAt), "MMM d, h:mm a")}
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
