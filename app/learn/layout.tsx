import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"

  let dbUser = null
  const userId = session?.user?.id || (isDevMode ? await getDevUserId() : null)
  if (userId) {
    dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    })
  }

  const user = session?.user
    ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        isAdmin: dbUser?.isAdmin ?? false,
      }
    : null

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar user={user} isDevMode={isDevMode} />
      <div className="h-14" />
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
