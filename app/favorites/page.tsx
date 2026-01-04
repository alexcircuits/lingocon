import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { BookCard } from "@/components/landing/book-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, ArrowRight } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

async function getFavorites(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: {
      userId,
    },
    include: {
      language: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              scriptSymbols: true,
              grammarPages: true,
              dictionaryEntries: true,
              favorites: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return favorites.map((f) => f.language)
}

export default async function FavoritesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const languages = await getFavorites(session.user.id)

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <div className="h-14" />

      <main className="container mx-auto py-10 px-4 max-w-6xl">
        {/* Page header */}
        <div className="mb-10 pb-6 border-b border-border/40">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-2">Favorites</h1>
          <p className="text-muted-foreground">
            {languages.length === 0
              ? "Languages you save will appear here"
              : `${languages.length} ${languages.length === 1 ? "language" : "languages"} saved`
            }
          </p>
        </div>

        {languages.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="text-center py-16">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
              <CardTitle className="text-lg font-serif">No favorites yet</CardTitle>
              <CardDescription className="max-w-sm mx-auto mt-2">
                Explore languages and add them to your favorites by clicking the heart icon
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-16">
              <Link href="/browse">
                <Button>
                  Browse Languages
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {languages.map((language) => (
              <BookCard key={language.id} language={language} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

