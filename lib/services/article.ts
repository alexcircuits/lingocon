import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { canEditScope } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError } from "@/lib/errors"
import { slugOrFallback } from "@/lib/utils/slug"
import { z } from "zod"
import { mediaUrlSchema } from "@/lib/validations/url"
import { assertParadigmInLanguage } from "@/lib/services/language-scope"

// Server actions receive arbitrary objects at runtime, so fields are picked explicitly — spreading
// the input let a caller set languageId/authorId and move an article into someone else's language.
const articleFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().max(1000).optional().nullable(),
  content: z.unknown().optional(),
  coverImage: mediaUrlSchema.optional().nullable().or(z.literal("")),
  published: z.boolean().optional(),
  paradigmId: z.string().optional().nullable(),
})
const articleUpdateSchema = articleFieldsSchema.partial()

function articleSlug(title: string): string {
  return slugOrFallback(title, "article", 50)
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
  const canWrite = await canEditScope(data.languageId, userId, "write:articles")
  const canDraft = !canWrite && await canEditScope(data.languageId, userId, "draft:articles")

  if (!canWrite && !canDraft) {
    throw new UnauthorizedError("You don't have permission to add articles to this language")
  }
  const fields = articleFieldsSchema.parse(data)
  await assertParadigmInLanguage(fields.paradigmId, data.languageId)

  const langSlug = (
    await prisma.language.findUnique({
      where: { id: data.languageId },
      select: { slug: true },
    })
  )?.slug

  const slug = await ensureUniqueSlug(data.languageId, articleSlug(fields.title))

  // Draft contributors always save as unpublished; writers respect the param.
  const published = canWrite ? (fields.published ?? true) : false

  const article = await prisma.article.create({
    data: {
      title: fields.title,
      slug,
      excerpt: fields.excerpt ?? undefined,
      content: fields.content as Prisma.InputJsonValue,
      coverImage: fields.coverImage || undefined,
      published,
      publishedAt: published ? new Date() : null,
      paradigmId: fields.paradigmId || null,
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

  const canWrite = await canEditScope(article.language.id, userId, "write:articles")

  // Draft contributors can edit their own unpublished articles only
  const isDraftAuthor =
    !canWrite &&
    article.authorId === userId &&
    !article.published &&
    (await canEditScope(article.language.id, userId, "draft:articles"))

  if (!canWrite && !isDraftAuthor) {
    throw new UnauthorizedError("You don't have permission to edit this article")
  }

  const fields = articleUpdateSchema.parse(data)
  await assertParadigmInLanguage(fields.paradigmId, article.languageId)

  let slug = article.slug
  if (fields.title && fields.title !== article.title) {
    slug = await ensureUniqueSlug(article.languageId, articleSlug(fields.title), id)
  }

  // Draft contributors cannot change published state
  const publishedNext = canWrite
    ? (fields.published ?? article.published)
    : article.published

  const updated = await prisma.article.update({
    where: { id },
    data: {
      ...(fields.title !== undefined && { title: fields.title }),
      ...(fields.excerpt !== undefined && { excerpt: fields.excerpt }),
      ...(fields.content !== undefined && { content: fields.content as Prisma.InputJsonValue }),
      ...(fields.coverImage !== undefined && { coverImage: fields.coverImage || null }),
      slug,
      paradigmId: fields.paradigmId !== undefined ? fields.paradigmId || null : article.paradigmId,
      published: publishedNext,
      publishedAt: publishedNext && !article.published ? new Date() : article.publishedAt,
    },
  })

  return { article: updated, langSlug: article.language.slug }
}

export async function publishArticle(id: string, userId: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { id: true, slug: true } } },
  })

  if (!article) throw new NotFoundError("Article", id)

  const canWrite = await canEditScope(article.language.id, userId, "write:articles")
  if (!canWrite) throw new UnauthorizedError("You don't have permission to publish articles")

  const updated = await prisma.article.update({
    where: { id },
    data: { published: true, publishedAt: article.publishedAt ?? new Date() },
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

  const canWrite = await canEditScope(article.language.id, userId, "write:articles")

  // Draft contributors can delete their own unpublished articles
  const isDraftAuthor =
    !canWrite &&
    article.authorId === userId &&
    !article.published &&
    (await canEditScope(article.language.id, userId, "draft:articles"))

  if (!canWrite && !isDraftAuthor) {
    throw new UnauthorizedError("You don't have permission to delete this article")
  }

  await prisma.article.delete({ where: { id } })

  return { langSlug: article.language.slug, articleSlug: article.slug }
}

export async function getDraftArticles(languageId: string, userId: string) {
  const canWrite = await canEditScope(languageId, userId, "write:articles")

  if (canWrite) {
    // Reviewers see all pending drafts (exclude their own so the list focuses on community submissions)
    return prisma.article.findMany({
      where: { languageId, published: false, authorId: { not: userId } },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    })
  }

  const canDraft = await canEditScope(languageId, userId, "draft:articles")
  if (!canDraft) return []

  // Contributors see only their own drafts
  return prisma.article.findMany({
    where: { languageId, published: false, authorId: userId },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  })
}
