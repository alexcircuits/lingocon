import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Newspaper, Calendar, User, ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

async function getLanguageWithArticles(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      articles: {
        where: { published: true },
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

  if (language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export default async function PublicArticlesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguageWithArticles(slug)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight mb-2">Articles & News</h1>
        <p className="text-muted-foreground">
          {language.articles.length} {language.articles.length === 1 ? 'article' : 'articles'} about {language.name}
        </p>
      </div>

      {language.articles.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/60 bg-muted/20">
          <Newspaper className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-serif font-medium mb-2">No articles yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            No articles have been published for this language yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {language.articles.map((article) => (
            <Link
              key={article.id}
              href={`/lang/${slug}/articles/${article.slug}`}
            >
              <Card className="p-5 hover:bg-secondary/30 hover:border-amber-500/30 transition-all duration-300 group cursor-pointer border-border/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-medium text-xl line-clamp-1 group-hover:text-amber-600 transition-colors">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {article.author.name || "Anonymous"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-amber-600 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}

