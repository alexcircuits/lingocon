import { prisma } from "@/lib/prisma"
import { canEditLanguage } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError } from "@/lib/errors"

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

async function ensureUniqueSlug(
  languageId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await prisma.article.findFirst({
      where: {
        languageId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    if (!existing) break
    slug = `${baseSlug}-${counter++}`
  }

  return slug
}

export async function createArticle(
  data: {
    title: string
    excerpt?: string
    content: any
    coverImage?: string
    published?: boolean
    paradigmId?: string | null
    languageId: string
  },
  userId: string
) {
  const canEdit = await canEditLanguage(data.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to add articles to this language")
  }

  const langSlug = (
    await prisma.language.findUnique({
      where: { id: data.languageId },
      select: { slug: true },
    })
  )?.slug

  const slug = await ensureUniqueSlug(data.languageId, generateSlug(data.title))

  const article = await prisma.article.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      coverImage: data.coverImage,
      published: true,
      publishedAt: new Date(),
      paradigmId: data.paradigmId || null,
      languageId: data.languageId,
      authorId: userId,
    },
  })

  return { article, langSlug }
}

export async function updateArticle(
  id: string,
  data: {
    title?: string
    excerpt?: string
    content?: any
    coverImage?: string
    published?: boolean
    paradigmId?: string | null
  },
  userId: string
) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true, id: true } } },
  })

  if (!article) {
    throw new NotFoundError("Article", id)
  }

  const canEdit = await canEditLanguage(article.language.id, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this article")
  }

  let slug = article.slug
  if (data.title && data.title !== article.title) {
    slug = await ensureUniqueSlug(article.languageId, generateSlug(data.title), id)
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      ...data,
      slug,
      paradigmId: data.paradigmId !== undefined ? data.paradigmId || null : article.paradigmId,
      published: true,
      publishedAt: !article.published ? new Date() : article.publishedAt,
    },
  })

  return { article: updated, langSlug: article.language.slug }
}

export async function deleteArticle(id: string, userId: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true, id: true } } },
  })

  if (!article) {
    throw new NotFoundError("Article", id)
  }

  const canEdit = await canEditLanguage(article.language.id, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to delete this article")
  }

  await prisma.article.delete({ where: { id } })

  return { langSlug: article.language.slug, articleSlug: article.slug }
}
