"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { revalidatePath } from "next/cache"

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
  const session = await auth()
  const userId = session?.user?.id || (process.env.DEV_MODE === "true" ? await getDevUserId() : null)

  if (!userId) {
    return { error: "Unauthorized" }
  }

  // Verify user owns or can edit the language
  const language = await prisma.language.findUnique({
    where: { id: data.languageId },
    select: { ownerId: true }
  })

  if (!language || language.ownerId !== userId) {
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
      published: data.published || false,
      publishedAt: data.published ? new Date() : null,
      paradigmId: data.paradigmId || null,
      languageId: data.languageId,
      authorId: userId,
    }
  })

  revalidatePath(`/studio/lang/${langSlug}/articles`)
  revalidatePath(`/studio/lang/${langSlug}/articles/${article.slug}`)
  revalidatePath(`/lang/${langSlug}/articles`)
  revalidatePath(`/lang/${langSlug}/articles/${article.slug}`)

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
  const session = await auth()
  const userId = session?.user?.id || (process.env.DEV_MODE === "true" ? await getDevUserId() : null)

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true } } }
  })

  if (!article || article.language.ownerId !== userId) {
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
      publishedAt: data.published && !article.published ? new Date() : article.publishedAt,
    }
  })

  revalidatePath(`/studio/lang/${article.language.slug}/articles`)
  revalidatePath(`/studio/lang/${article.language.slug}/articles/${updated.slug}`)
  revalidatePath(`/lang/${article.language.slug}/articles`)
  revalidatePath(`/lang/${article.language.slug}/articles/${updated.slug}`)

  return { article: updated }
}

export async function deleteArticle(id: string) {
  const session = await auth()
  const userId = session?.user?.id || (process.env.DEV_MODE === "true" ? await getDevUserId() : null)

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const article = await prisma.article.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true } } }
  })

  if (!article || article.language.ownerId !== userId) {
    return { error: "You don't have permission to delete this article" }
  }

  await prisma.article.delete({ where: { id } })

  revalidatePath(`/studio/lang/${article.language.slug}/articles`)
  revalidatePath(`/studio/lang/${article.language.slug}/articles/${article.slug}`)
  revalidatePath(`/lang/${article.language.slug}/articles`)
  revalidatePath(`/lang/${article.language.slug}/articles/${article.slug}`)

  return { success: true }
}

