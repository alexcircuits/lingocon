import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, BookOpen, ExternalLink, Calendar } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { UnpublishButton } from "@/components/admin/unpublish-button"

export const dynamic = "force-dynamic"

async function getRecentContent() {
    await requireAdmin()

    const [articles, texts] = await Promise.all([
        prisma.article.findMany({
            where: { published: true },
            include: {
                language: { select: { name: true, slug: true } },
                author: { select: { name: true, email: true } }
            },
            orderBy: { publishedAt: "desc" },
            take: 10
        }),
        prisma.text.findMany({
            where: { published: true },
            include: {
                language: { select: { name: true, slug: true } },
                author: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 10
        })
    ])

    return { articles, texts }
}

async function ContentList() {
    const { articles, texts } = await getRecentContent()

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Articles */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Recent Articles ({articles.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {articles.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No published articles yet
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {articles.map((article) => (
                                <div
                                    key={article.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{article.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {article.language.name} · by {article.author.name || article.author.email}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {article.publishedAt ? format(new Date(article.publishedAt), "MMM d, yyyy") : "Draft"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <UnpublishButton id={article.id} type="article" title={article.title} />
                                        <Link
                                            href={`/lang/${article.language.slug}/articles/${article.slug}`}
                                            target="_blank"
                                            className="text-muted-foreground hover:text-primary transition-colors p-2"
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

            {/* Recent Texts */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Recent Texts ({texts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {texts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No published texts yet
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {texts.map((text) => (
                                <div
                                    key={text.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium truncate">{text.title}</p>
                                            <Badge variant="secondary" className="text-xs">
                                                {text.type.toLowerCase()}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {text.language.name} · by {text.author.name || text.author.email}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(text.createdAt), "MMM d, yyyy")}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <UnpublishButton id={text.id} type="text" title={text.title} />
                                        <Link
                                            href={`/lang/${text.language.slug}/texts/${text.slug}`}
                                            target="_blank"
                                            className="text-muted-foreground hover:text-primary transition-colors p-2"
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

function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-muted rounded-xl animate-pulse" />
            <div className="h-96 bg-muted rounded-xl animate-pulse" />
        </div>
    )
}

export default function AdminContentPage() {
    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">Content</h1>
                <p className="text-muted-foreground">
                    Review recently published articles and texts
                </p>
            </div>

            {/* Content Lists */}
            <Suspense fallback={<LoadingSkeleton />}>
                <ContentList />
            </Suspense>
        </div>
    )
}
