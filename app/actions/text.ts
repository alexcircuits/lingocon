"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { revalidatePath } from "next/cache"
import { TextType } from "@prisma/client"
import { checkContentBadges } from "@/app/actions/badge"

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

export async function createText(data: {
  title: string
  description?: string
  type: TextType
  content?: any
  fileUrl?: string
  fileName?: string
  fileSize?: number
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
    return { error: "You don't have permission to add texts to this language" }
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
    const existing = await prisma.text.findUnique({
      where: { languageId_slug: { languageId: data.languageId, slug } }
    })
    if (!existing) break
    slug = `${baseSlug}-${counter++}`
  }

  const text = await prisma.text.create({
    data: {
      title: data.title,
      slug,
      description: data.description,
      type: data.type,
      content: data.content,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      coverImage: data.coverImage,
      published: true,
      paradigmId: data.paradigmId || null,
      languageId: data.languageId,
      authorId: userId,
    }
  })

  revalidatePath(`/studio/lang/${langSlug}/texts`)
  revalidatePath(`/studio/lang/${langSlug}/texts/${text.slug}`)
  revalidatePath(`/lang/${langSlug}/texts`)
  revalidatePath(`/lang/${langSlug}/texts/${text.slug}`)

  // Check for content badges
  checkContentBadges(userId).catch(console.error)

  return { text }
}

export async function updateText(
  id: string,
  data: {
    title?: string
    description?: string
    type?: TextType
    content?: any
    fileUrl?: string
    fileName?: string
    fileSize?: number
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

  const text = await prisma.text.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true } } }
  })

  if (!text || text.language.ownerId !== userId) {
    return { error: "You don't have permission to edit this text" }
  }

  // Update slug if title changed
  let slug = text.slug
  if (data.title && data.title !== text.title) {
    const baseSlug = generateSlug(data.title)
    slug = baseSlug
    let counter = 1

    while (true) {
      const existing = await prisma.text.findFirst({
        where: {
          languageId: text.languageId,
          slug,
          id: { not: id }
        }
      })
      if (!existing) break
      slug = `${baseSlug}-${counter++}`
    }
  }

  const updated = await prisma.text.update({
    where: { id },
    data: {
      ...data,
      published: true,
      slug,
      paradigmId: data.paradigmId !== undefined ? (data.paradigmId || null) : text.paradigmId,
    }
  })

  revalidatePath(`/studio/lang/${text.language.slug}/texts`)
  revalidatePath(`/studio/lang/${text.language.slug}/texts/${updated.slug}`)
  revalidatePath(`/lang/${text.language.slug}/texts`)
  revalidatePath(`/lang/${text.language.slug}/texts/${updated.slug}`)

  return { text: updated }
}

export async function deleteText(id: string) {
  const session = await auth()
  const userId = session?.user?.id || (process.env.DEV_MODE === "true" ? await getDevUserId() : null)

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const text = await prisma.text.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true } } }
  })

  if (!text || text.language.ownerId !== userId) {
    return { error: "You don't have permission to delete this text" }
  }

  await prisma.text.delete({ where: { id } })

  revalidatePath(`/studio/lang/${text.language.slug}/texts`)
  revalidatePath(`/studio/lang/${text.language.slug}/texts/${text.slug}`)
  revalidatePath(`/lang/${text.language.slug}/texts`)
  revalidatePath(`/lang/${text.language.slug}/texts/${text.slug}`)

  return { success: true }
}

