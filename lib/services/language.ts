import { prisma } from "@/lib/prisma"
import { canEditLanguage } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError, ConflictError } from "@/lib/errors"
import {
  createLanguageSchema,
  updateLanguageSchema,
  type CreateLanguageInput,
  type UpdateLanguageInput,
} from "@/lib/validations/language"

export async function createLanguage(input: CreateLanguageInput, userId: string) {
  const validated = createLanguageSchema.parse(input)

  const existing = await prisma.language.findUnique({
    where: { slug: validated.slug },
  })

  if (existing) {
    throw new ConflictError("A language with this slug already exists")
  }

  return prisma.language.create({
    data: {
      name: validated.name,
      slug: validated.slug,
      description: validated.description || null,
      visibility: validated.visibility,
      metadata: validated.metadata ? (validated.metadata as any) : null,
      ownerId: userId,
    },
  })
}

export async function updateLanguage(input: UpdateLanguageInput, userId: string) {
  const validated = updateLanguageSchema.parse(input)

  const canEdit = await canEditLanguage(validated.id, userId)
  if (!canEdit) {
    throw new UnauthorizedError()
  }

  const updateData: Record<string, unknown> = {}
  if (validated.name !== undefined) updateData.name = validated.name
  if (validated.description !== undefined) updateData.description = validated.description || null
  if (validated.visibility !== undefined) updateData.visibility = validated.visibility
  if (validated.flagUrl !== undefined) updateData.flagUrl = validated.flagUrl || null
  if (validated.discordUrl !== undefined) updateData.discordUrl = validated.discordUrl || null
  if (validated.telegramUrl !== undefined) updateData.telegramUrl = validated.telegramUrl || null
  if (validated.websiteUrl !== undefined) updateData.websiteUrl = validated.websiteUrl || null
  if (validated.fontUrl !== undefined) updateData.fontUrl = validated.fontUrl || null
  if (validated.fontFamily !== undefined) updateData.fontFamily = validated.fontFamily || null
  if (validated.fontScale !== undefined) updateData.fontScale = validated.fontScale
  if (validated.allowsDiacritics !== undefined) updateData.allowsDiacritics = validated.allowsDiacritics
  if (validated.allowForking !== undefined) updateData.allowForking = validated.allowForking
  if (validated.metadata !== undefined) updateData.metadata = validated.metadata

  return prisma.language.update({
    where: { id: validated.id },
    data: updateData,
  })
}

export async function deleteLanguage(languageId: string, userId: string) {
  if (process.env.DEV_MODE !== "true") {
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || language.ownerId !== userId) {
      throw new UnauthorizedError()
    }
  }

  await prisma.language.delete({
    where: { id: languageId },
  })
}

export async function updateLanguageMetadata(
  languageId: string,
  updates: Record<string, any>,
  userId: string
) {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true, metadata: true },
  })

  if (!language || language.ownerId !== userId) {
    throw new UnauthorizedError()
  }

  const existing = (language.metadata as Record<string, any>) || {}
  const merged = { ...existing, ...updates }

  await prisma.language.update({
    where: { id: languageId },
    data: { metadata: merged },
  })
}
