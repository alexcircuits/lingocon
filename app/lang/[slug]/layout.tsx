import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PublicLayout } from "../public-layout"
import { getUserId } from "@/lib/auth-helpers"

async function getLanguage(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      ownerId: true,
    },
  })

  if (!language) {
    return null
  }

  // Enforce visibility rules
  if (language.visibility === "PRIVATE") {
    // Allow access if owner
    if (userId && language.ownerId === userId) {
      return language
    }
    // Also allow if dev mode (handled by auth check mostly, but good to be safe)
    if (process.env.DEV_MODE === "true") {
      return language
    }
    return null
  }

  return language
}

export default async function PublicLangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  const userId = session?.user?.id || null
  
  const language = await getLanguage(slug, userId)

  if (!language) {
    notFound()
  }

  const isDevMode = process.env.DEV_MODE === "true"
  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <PublicLayout 
      language={language} 
      user={user}
      isDevMode={isDevMode}
    >
      {children}
    </PublicLayout>
  )
}
