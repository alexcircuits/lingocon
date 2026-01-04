import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { redirect, notFound } from "next/navigation"
import { TextEditor } from "../text-editor"

async function getText(languageSlug: string, textSlug: string, userId: string | null) {
  const language = await prisma.language.findUnique({
    where: { slug: languageSlug },
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

  // Allow access if user is owner or collaborator (skip in dev mode)
  if (process.env.DEV_MODE !== "true" && userId) {
    const { canEditLanguage } = await import("@/lib/auth-helpers")
    const canEdit = await canEditLanguage(language.id, userId)
    if (!canEdit) {
      return { language, text: null }
    }
  }

  const text = await prisma.text.findUnique({
    where: {
      languageId_slug: {
        languageId: language.id,
        slug: textSlug,
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      coverImage: true,
      paradigmId: true,
    },
  })

  return { language, text }
}

export default async function EditTextPage({
  params,
}: {
  params: Promise<{ slug: string; textSlug: string }>
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const { slug, textSlug } = await params
  const result = await getText(slug, textSlug, userId)

  if (!result || !result.language) {
    notFound()
  }

  if (!result.text) {
    notFound()
  }

  return (
    <TextEditor
      languageId={result.language.id}
      languageSlug={slug}
      text={{
        id: result.text.id,
        title: result.text.title,
        slug: result.text.slug,
        content: typeof result.text.content === 'string' ? result.text.content : JSON.stringify(result.text.content || ''),
        coverImage: result.text.coverImage,
        paradigmId: result.text.paradigmId,
      }}
    />
  )
}

