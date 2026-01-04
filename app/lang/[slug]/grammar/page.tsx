import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      grammarPages: {
        orderBy: {
          order: "asc",
        },
      },
    },
  })

  if (!language || language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export default async function GrammarIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Grammar</h2>
        <p className="mt-2 text-muted-foreground">
          Grammar documentation and linguistic rules
        </p>
      </div>

      {language.grammarPages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No grammar pages have been created yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {language.grammarPages.map((page) => (
            <Link
              key={page.id}
              href={`/lang/${language.slug}/grammar/${page.slug}`}
              className="block rounded-lg border p-6 transition-colors hover:bg-accent/50"
            >
              <h3 className="text-xl font-semibold">{page.title}</h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

