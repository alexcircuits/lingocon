/**
 * Server Actions for `Text` records (long-form writing attached to a language).
 *
 * Flow for every mutation:
 * 1. Resolve the caller with `getUserId`.
 * 2. Authorize via `canEditScope` with "write:texts" (owners, editors with that permission, and admins pass).
 * 3. Touch Prisma, then `revalidatePath` for both studio and public `/lang/...` URLs.
 *
 * Slugs are unique per `languageId`; when titles change we scan for collisions the same way as on create.
 */
"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { TextType } from "@prisma/client"
import { checkContentBadges } from "@/app/actions/badge"
import { slugOrFallback } from "@/lib/utils/slug"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { mediaUrlSchema } from "@/lib/validations/url"
import { assertParadigmInLanguage } from "@/lib/services/language-scope"

// Explicit, validated fields: spreading the raw action input into prisma.text.update let a caller
// set languageId/authorId and move a text into another user's language.
const textFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.nativeEnum(TextType),
  content: z.unknown().optional(),
  fileUrl: mediaUrlSchema.optional().nullable().or(z.literal("")),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  coverImage: mediaUrlSchema.optional().nullable().or(z.literal("")),
  paradigmId: z.string().optional().nullable(),
})
const textUpdateSchema = textFieldsSchema.partial()

/** URL-safe slug derived from a title; not globally unique — uniqueness is enforced per language. */
function textSlug(title: string): string {
  return slugOrFallback(title, "text", 50)
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
  const canEdit = await canEditScope(data.languageId, userId, "write:texts")
  if (!canEdit) {
    return { error: "You don't have permission to add texts to this language" }
  }

  const parsed = textFieldsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid text" }
  const fields = parsed.data
  try {
    await assertParadigmInLanguage(fields.paradigmId, data.languageId)
  } catch {
    return { error: "Paradigm not found" }
  }

  // Get the slug as well
  const langSlug = (await prisma.language.findUnique({
    where: { id: data.languageId },
    select: { slug: true }
  }))?.slug

  const baseSlug = textSlug(fields.title)
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
      title: fields.title,
      slug,
      description: fields.description ?? undefined,
      type: fields.type,
      content: fields.content as Prisma.InputJsonValue | undefined,
      fileUrl: fields.fileUrl || undefined,
      fileName: fields.fileName ?? undefined,
      fileSize: fields.fileSize ?? undefined,
      coverImage: fields.coverImage || undefined,
      published: true,
      paradigmId: fields.paradigmId || null,
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

  const canEdit = await canEditScope(text.language.id, userId, "write:texts")
  if (!canEdit) {
    return { error: "You don't have permission to edit this text" }
  }

  const parsed = textUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid text" }
  const fields = parsed.data
  try {
    await assertParadigmInLanguage(fields.paradigmId, text.languageId)
  } catch {
    return { error: "Paradigm not found" }
  }

  // Update slug if title changed
  let slug = text.slug
  if (fields.title && fields.title !== text.title) {
    const baseSlug = textSlug(fields.title)
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
      ...(fields.title !== undefined && { title: fields.title }),
      ...(fields.description !== undefined && { description: fields.description }),
      ...(fields.type !== undefined && { type: fields.type }),
      ...(fields.content !== undefined && { content: fields.content as Prisma.InputJsonValue }),
      ...(fields.fileUrl !== undefined && { fileUrl: fields.fileUrl || null }),
      ...(fields.fileName !== undefined && { fileName: fields.fileName }),
      ...(fields.fileSize !== undefined && { fileSize: fields.fileSize }),
      ...(fields.coverImage !== undefined && { coverImage: fields.coverImage || null }),
      published: true,
      slug,
      paradigmId: fields.paradigmId !== undefined ? (fields.paradigmId || null) : text.paradigmId,
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

  const canEdit = await canEditScope(text.language.id, userId, "write:texts")
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

