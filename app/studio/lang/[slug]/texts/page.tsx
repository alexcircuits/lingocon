import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, BookOpen, Calendar, User, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { EmptyState } from "@/components/empty-state"

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

function getWordCount(content: any): number {
  if (!content) return 0
  if (typeof content === 'string') {
    return content.split(/\s+/).filter(Boolean).length
  }
  // If it's JSON, try to extract text
  const jsonString = JSON.stringify(content)
  return jsonString.split(/\s+/).filter(Boolean).length
}

function getContentPreview(content: any): string {
  if (!content) return ""
  if (typeof content === 'string') {
    return content.substring(0, 200)
  }
  // If it's JSON, try to extract text
  const jsonString = JSON.stringify(content)
  return jsonString.substring(0, 200)
}

function getContentLength(content: any): number {
  if (!content) return 0
  if (typeof content === 'string') {
    return content.length
  }
  return JSON.stringify(content).length
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
      <div className="pb-6 border-b border-border/40 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif tracking-tight mb-1">Texts</h1>
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
                    <h3 className="font-semibold text-lg truncate mb-1">
                      {text.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {getContentPreview(text.content)}
                      {getContentLength(text.content) > 200 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {getWordCount(text.content).toLocaleString()} words
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

