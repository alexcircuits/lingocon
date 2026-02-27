"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { checkContentBadges } from "@/app/actions/badge"

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

export async function createArticle(data: {
  title: string
  excerpt?: string
  content: any
  coverImage?: string
  published?: boolean
  paradigmId?: string | null
  languageId: string
}) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  // Verify user owns or can edit the language
  const canEdit = await canEditLanguage(data.languageId, userId)
  if (!canEdit) {
    return { error: "You don't have permission to add articles to this language" }
  }

  // Get the slug as well
  const langSlug = (await prisma.language.findUnique({
    where: { id: data.languageId },
    select: { slug: true }
  }))?.slug

  const baseSlug = generateSlug(data.title)
  let slug = baseSlug
  let counter = 1

  // Ensure unique slug
  while (true) {
    const existing = await prisma.article.findUnique({
      where: { languageId_slug: { languageId: data.languageId, slug } }
    })
    if (!existing) break
    slug = `${baseSlug}-${counter++}`
  }

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
    }
  })

  revalidatePath(`/studio/lang/${langSlug}/articles`)
  revalidatePath(`/studio/lang/${langSlug}/articles/${article.slug}`)
  revalidatePath(`/lang/${langSlug}/articles`)
  revalidatePath(`/lang/${langSlug}/articles/${article.slug}`)

  // Check for content badges if article is published
  if (data.published) {
    checkContentBadges(userId).catch(console.error)
  }

  return { article }
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
  }
) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true, id: true } } }
  })

  if (!article) {
    return { error: "Article not found" }
  }

  const canEdit = await canEditLanguage(article.language.id, userId)
  if (!canEdit) {
    return { error: "You don't have permission to edit this article" }
  }

  // Update slug if title changed
  let slug = article.slug
  if (data.title && data.title !== article.title) {
    const baseSlug = generateSlug(data.title)
    slug = baseSlug
    let counter = 1

    while (true) {
      const existing = await prisma.article.findFirst({
        where: {
          languageId: article.languageId,
          slug,
          id: { not: id }
        }
      })
      if (!existing) break
      slug = `${baseSlug}-${counter++}`
    }
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      ...data,
      slug,
      paradigmId: data.paradigmId !== undefined ? (data.paradigmId || null) : article.paradigmId,
      published: true,
      publishedAt: !article.published ? new Date() : article.publishedAt,
    }
  })

  revalidatePath(`/studio/lang/${article.language.slug}/articles`)
  revalidatePath(`/studio/lang/${article.language.slug}/articles/${updated.slug}`)
  revalidatePath(`/lang/${article.language.slug}/articles`)
  revalidatePath(`/lang/${article.language.slug}/articles/${updated.slug}`)

  return { article: updated }
}

export async function deleteArticle(id: string) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true, id: true } } }
  })

  if (!article) {
    return { error: "Article not found" }
  }

  const canEdit = await canEditLanguage(article.language.id, userId)
  if (!canEdit) {
    return { error: "You don't have permission to delete this article" }
  }

  await prisma.article.delete({ where: { id } })

  revalidatePath(`/studio/lang/${article.language.slug}/articles`)
  revalidatePath(`/studio/lang/${article.language.slug}/articles/${article.slug}`)
  revalidatePath(`/lang/${article.language.slug}/articles`)
  revalidatePath(`/lang/${article.language.slug}/articles/${article.slug}`)

  return { success: true }
}

