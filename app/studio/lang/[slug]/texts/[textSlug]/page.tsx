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

  // Every text write needs write:texts (lib/services/text; "draft:texts" is not honoured there).
  // Anyone else who can view the project — the list shows them every text — reads it read-only.
  // Dev mode without a user keeps full access.
  let readOnly = false
  if (process.env.DEV_MODE !== "true" && userId) {
    const { canEditScope, canViewLanguage } = await import("@/lib/auth-helpers")
    readOnly = !(await canEditScope(language.id, userId, "write:texts"))
    if (readOnly && !(await canViewLanguage(language.id, userId))) return { language, text: null, readOnly }
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
      published: true,
      coverImage: true,
      paradigmId: true,
      // The editor's revision token (optimistic concurrency on save).
      updatedAt: true,
    },
  })

  // Unpublished texts are for people who can edit them (as for articles).
  if (text && readOnly && !text.published) return { language, text: null, readOnly }
  return { language, text, readOnly }
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
      readOnly={result.readOnly}
      text={{
        id: result.text.id,
        title: result.text.title,
        slug: result.text.slug,
        content: typeof result.text.content === 'string' ? result.text.content : JSON.stringify(result.text.content || ''),
        published: result.text.published,
        coverImage: result.text.coverImage,
        paradigmId: result.text.paradigmId,
        updatedAt: result.text.updatedAt,
      }}
    />
  )
}

