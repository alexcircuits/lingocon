import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, BookOpen, Calendar, User, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { EmptyState } from "@/components/empty-state"
import { documentToPlainText } from "@/lib/utils/tiptap-text"

async function getLanguageWithTexts(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      texts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          published: true,
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

function getTextStats(content: unknown): { words: number; excerpt: string } {
  const text = documentToPlainText(content)
  const words = text.length > 0 ? text.split(/\s+/).length : 0
  const excerpt = text.length > 180 ? text.slice(0, 180).trimEnd() + "…" : text
  return { words, excerpt }
}

export default async function TextsPage({
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
  const language = await getLanguageWithTexts(slug, userId)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Texts</h1>
          <p className="text-muted-foreground">
            Upload and manage texts, books, and other written content in your language
          </p>
        </div>
        <Link href={`/studio/lang/${slug}/texts/new`}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Text
          </Button>
        </Link>
      </div>

      {language.texts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No texts yet"
          description="Add your first text to build a corpus of content in your language. Upload books, stories, poems, or any other written material."
          action={{
            label: "Add Your First Text",
            href: `/studio/lang/${slug}/texts/new`,
          }}
        />
      ) : (
        <div className="grid gap-4">
          {language.texts.map((text) => (
            <Link
              key={text.id}
              href={`/studio/lang/${slug}/texts/${text.slug}`}
            >
              <Card className="p-5 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">
                        {text.title}
                      </h3>
                      {text.published ? (
                        <Badge className="shrink-0 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
                          Published
                        </Badge>
                      ) : (
                        <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
                          Draft
                        </Badge>
                      )}
                    </div>
                    {(() => {
                      const { words, excerpt } = getTextStats(text.content)
                      return (
                        <>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {excerpt}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {words.toLocaleString()} words
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {text.author.name || "Unknown"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDistanceToNow(new Date(text.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

