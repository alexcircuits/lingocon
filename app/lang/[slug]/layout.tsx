import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { PATHNAME_HEADER, withRenamedSlug } from "@/lib/project-path"
import { findReservedSlugTarget } from "@/lib/services/slug-reservation"
import { PublicLayout } from "../public-layout"
import { getUserId } from "@/lib/auth-helpers"
import { FontLoader } from "@/components/font-loader"

async function getLanguage(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      ownerId: true,
      fontUrl: true,
      fontFamily: true,
      fontScale: true,
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
    // Renamed projects keep their old slug reserved. Full page loads are
    // redirected by middleware; client navigations land here instead.
    const target = await findReservedSlugTarget(slug)
    // Same section of the renamed project (the middleware passes the requested path).
    if (target) redirect(withRenamedSlug(headers().get(PATHNAME_HEADER), "/lang", slug, target))
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
      <FontLoader fontUrl={language.fontUrl} fontFamily={language.fontFamily} fontScale={language.fontScale} />
      {children}
    </PublicLayout>
  )
}
