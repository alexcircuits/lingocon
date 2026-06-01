import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { BookMarked, FileText, User, ArrowRight } from "lucide-react"
import { documentToPlainText } from "@/lib/utils/tiptap-text"

async function getLanguageWithTexts(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      texts: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
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

function getTextStats(content: unknown): { words: number; excerpt: string } {
  const text = documentToPlainText(content)
  const words = text.length > 0 ? text.split(/\s+/).length : 0
  const excerpt = text.length > 180 ? text.slice(0, 180).trimEnd() + "…" : text
  return { words, excerpt }
}

export default async function PublicTextsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguageWithTexts(slug)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight mb-2">Texts & Books</h1>
        <p className="text-muted-foreground">
          {language.texts.length} {language.texts.length === 1 ? 'text' : 'texts'} in {language.name}
        </p>
      </div>

      {language.texts.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/60 bg-muted/20">
          <BookMarked className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-serif font-medium mb-2">No texts yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            No texts have been uploaded for this language yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {language.texts.map((text) => {
            const { words, excerpt } = getTextStats(text.content)
            return (
            <Link
              key={text.id}
              href={`/lang/${slug}/texts/${text.slug}`}
            >
              <Card className="p-5 hover:bg-secondary/30 hover:border-primary/30 transition-all duration-300 group cursor-pointer border-border/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-medium text-xl line-clamp-1 group-hover:text-primary transition-colors">
                      {text.title}
                    </h3>
                    {excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {words > 0 ? `${words.toLocaleString()} words` : "No content"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {text.author.name || "Anonymous"}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
                </div>
              </Card>
            </Link>
            )
          })}
        </div>
      )}

    </div>
  )
}

