import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { TextEditor } from "../text-editor"

async function getLanguage(slug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
    },
  })

  if (!language) {
    return null
  }

  // Creating a text needs write:texts (lib/services/text refuses everyone else, "draft:texts"
  // included), so nobody else is offered the form (skip in dev mode).
  if (process.env.DEV_MODE !== "true" && userId) {
    const { canEditScope } = await import("@/lib/auth-helpers")
    if (!(await canEditScope(language.id, userId, "write:texts"))) return null
  }

  return language
}

export default async function NewTextPage({
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
  const language = await getLanguage(slug, userId)

  if (!language) {
    notFound()
  }

  return (
    <TextEditor languageId={language.id} languageSlug={slug} />
  )
}

