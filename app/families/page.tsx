import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { Navbar } from "@/components/navbar"
import { LingoConUniverseMap } from "@/components/landing/universe-map"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Language Family Map — LingoCon",
  description: "Explore all public constructed language families and how they interconnect. An interactive map of the LingoCon universe.",
}

export default async function PublicFamiliesPage() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"

  const languages = await prisma.language.findMany({
    where: { visibility: "PUBLIC" },
    select: {
      id: true,
      name: true,
      slug: true,
      flagUrl: true,
      parentLanguageId: true,
      externalAncestry: true,
      owner: { select: { name: true } },
      _count: { select: { dictionaryEntries: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const user = session?.user
    ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
    : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user as any} isDevMode={isDevMode} />
      <div className="h-14 shrink-0" />

      <main className="flex-1 relative flex flex-col">
        {languages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h2 className="text-2xl font-serif font-medium">No Public Languages Yet</h2>
              <p className="text-muted-foreground">
                Once users publish their constructed languages, they&apos;ll appear here as an interactive family map.
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0">
            <LingoConUniverseMap languages={languages as any} />
          </div>
        )}
      </main>
    </div>
  )
}
