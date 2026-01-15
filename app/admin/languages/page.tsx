import { Suspense } from "react"
import { getAllLanguages } from "@/app/actions/admin-analytics"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Languages,
    BookOpen,
    FileText,
    Heart,
    Eye,
    EyeOff,
    Globe,
    ExternalLink
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { Pagination } from "@/components/admin/pagination"

export const dynamic = "force-dynamic"

const visibilityIcons = {
    PUBLIC: Globe,
    UNLISTED: EyeOff,
    PRIVATE: Eye
}

const visibilityColors = {
    PUBLIC: "bg-green-500/10 text-green-600",
    UNLISTED: "bg-yellow-500/10 text-yellow-600",
    PRIVATE: "bg-gray-500/10 text-gray-600"
}

async function LanguagesList({
    visibility,
    page
}: {
    visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE" | "ALL"
    page?: number
}) {
    const { languages, pagination } = await getAllLanguages({
        visibility,
        page: page || 1,
        limit: 20
    })

    if (languages.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Languages className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No languages found</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                {languages.map((lang) => {
                    const VisIcon = visibilityIcons[lang.visibility as keyof typeof visibilityIcons]
                    const visColor = visibilityColors[lang.visibility as keyof typeof visibilityColors]

                    return (
                        <Link
                            key={lang.id}
                            href={`/admin/languages/${lang.id}`}
                            className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-colors"
                        >
                            <div className={`p-2 rounded-lg ${visColor}`}>
                                <VisIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{lang.name}</p>
                                    <Badge variant="outline" className="text-xs">
                                        /{lang.slug}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    by {lang.owner}
                                </p>
                            </div>
                            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <BookOpen className="h-4 w-4" />
                                    <span>{lang.entries}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <FileText className="h-4 w-4" />
                                    <span>{lang.grammarPages}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Heart className="h-4 w-4" />
                                    <span>{lang.favorites}</span>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {format(new Date(lang.createdAt), "MMM d, yyyy")}
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Link>
                    )
                })}
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
            />
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
        </div>
    )
}

export default async function AdminLanguagesPage({
    searchParams,
}: {
    searchParams: Promise<{ visibility?: string; page?: string }>
}) {
    const params = await searchParams
    const visibility = (params.visibility as "PUBLIC" | "UNLISTED" | "PRIVATE" | "ALL") || "ALL"
    const page = params.page ? parseInt(params.page) : 1

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">Languages</h1>
                <p className="text-muted-foreground">
                    Overview of all languages on the platform
                </p>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="flex gap-2">
                        <Link
                            href="/admin/languages"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visibility === "ALL"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                                }`}
                        >
                            All
                        </Link>
                        <Link
                            href="/admin/languages?visibility=PUBLIC"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visibility === "PUBLIC"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                                }`}
                        >
                            Public
                        </Link>
                        <Link
                            href="/admin/languages?visibility=UNLISTED"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visibility === "UNLISTED"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                                }`}
                        >
                            Unlisted
                        </Link>
                        <Link
                            href="/admin/languages?visibility=PRIVATE"
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visibility === "PRIVATE"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                                }`}
                        >
                            Private
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Languages List */}
            <Suspense fallback={<LoadingSkeleton />}>
                <LanguagesList visibility={visibility} page={page} />
            </Suspense>
        </div>
    )
}
