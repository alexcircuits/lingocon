/**
 * Server Actions for `Text` records (long-form writing attached to a language).
 *
 * Flow for every mutation:
 * 1. Resolve the caller with `getUserId`.
 * 2. Authorize via `canEditLanguage` (owners, editors, and admins pass).
 * 3. Touch Prisma, then `revalidatePath` for both studio and public `/lang/...` URLs.
 *
 * Slugs are unique per `languageId`; when titles change we scan for collisions the same way as on create.
 */
"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { TextType } from "@prisma/client"
import { checkContentBadges } from "@/app/actions/badge"

/** URL-safe slug derived from a title; not globally unique — uniqueness is enforced per language. */
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
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  // Verify user owns or can edit the language
  const canEdit = await canEditLanguage(data.languageId, userId)
  if (!canEdit) {
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
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const text = await prisma.text.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true, id: true } } }
  })

  if (!text) {
    return { error: "Text not found" }
  }

  const canEdit = await canEditLanguage(text.language.id, userId)
  if (!canEdit) {
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
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const text = await prisma.text.findUnique({
    where: { id },
    include: { language: { select: { ownerId: true, slug: true, id: true } } }
  })

  if (!text) {
    return { error: "Text not found" }
  }

  const canEdit = await canEditLanguage(text.language.id, userId)
  if (!canEdit) {
    return { error: "You don't have permission to delete this text" }
  }

  await prisma.text.delete({ where: { id } })

  revalidatePath(`/studio/lang/${text.language.slug}/texts`)
  revalidatePath(`/studio/lang/${text.language.slug}/texts/${text.slug}`)
  revalidatePath(`/lang/${text.language.slug}/texts`)
  revalidatePath(`/lang/${text.language.slug}/texts/${text.slug}`)

  return { success: true }
}

