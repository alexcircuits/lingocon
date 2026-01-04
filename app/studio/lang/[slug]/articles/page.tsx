import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, FileText, Calendar, User } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { EmptyState } from "@/components/empty-state"

async function getLanguageWithArticles(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      articles: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!language) {
    return null
  }

  // Allow access if user is owner or collaborator (skip in dev mode)
  if (process.env.DEV_MODE !== "true" && userId) {
    const { canViewLanguage } = await import("@/lib/auth-helpers")
    const canView = await canViewLanguage(language.id, userId)
    if (!canView) {
      return null
    }
  }

  return language
}

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug } = await params
  const language = await getLanguageWithArticles(slug, userId)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif tracking-tight mb-1">Articles</h1>
          <p className="text-muted-foreground">
            Write news updates, announcements, and articles about your language
          </p>
        </div>
        <Link href={`/studio/lang/${slug}/articles/new`}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Article
          </Button>
        </Link>
      </div>

      {language.articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No articles yet"
          description="Create your first article to share news, updates, and insights about your language with your community."
          action={{
            label: "Write Your First Article",
            href: `/studio/lang/${slug}/articles/new`,
          }}
        />
      ) : (
        <div className="grid gap-4">
          {language.articles.map((article) => (
            <Link
              key={article.id}
              href={`/studio/lang/${slug}/articles/${article.slug}`}
            >
              <Card className="p-5 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate mb-1">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {article.author.name || "Unknown"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(article.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

