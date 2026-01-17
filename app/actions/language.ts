"use server"

import { ZodError } from "zod"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import {
  createLanguageSchema,
  updateLanguageSchema,
  type CreateLanguageInput,
  type UpdateLanguageInput,
} from "@/lib/validations/language"
import { checkLanguageBadges } from "@/app/actions/badge"

export async function createLanguage(input: CreateLanguageInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = createLanguageSchema.parse(input)

    // Check if slug already exists
    const existing = await prisma.language.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      return {
        error: "A language with this slug already exists",
      }
    }

    const language = await prisma.language.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description || null,
        visibility: validated.visibility,
        metadata: validated.metadata ? (validated.metadata as any) : null,
        ownerId: userId,
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/browse")

    // Check for language-related badge achievements
    checkLanguageBadges(userId).catch(console.error)

    return {
      success: true,
      data: language,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to create language",
    }
  }
}

export async function updateLanguage(input: UpdateLanguageInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = updateLanguageSchema.parse(input)

    // Verify ownership (skip in dev mode)
    if (process.env.DEV_MODE !== "true") {
      const language = await prisma.language.findUnique({
        where: { id: validated.id },
        select: { ownerId: true },
      })

      if (!language || language.ownerId !== userId) {
        return {
          error: "Unauthorized",
        }
      }
    }

    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.description !== undefined)
      updateData.description = validated.description || null
    if (validated.visibility !== undefined)
      updateData.visibility = validated.visibility
    if (validated.flagUrl !== undefined)
      updateData.flagUrl = validated.flagUrl || null
    if (validated.discordUrl !== undefined)
      updateData.discordUrl = validated.discordUrl || null
    if (validated.telegramUrl !== undefined)
      updateData.telegramUrl = validated.telegramUrl || null
    if (validated.websiteUrl !== undefined)
      updateData.websiteUrl = validated.websiteUrl || null
    if (validated.fontUrl !== undefined)
      updateData.fontUrl = validated.fontUrl || null
    if (validated.fontFamily !== undefined)
      updateData.fontFamily = validated.fontFamily || null
    if (validated.fontScale !== undefined)
      updateData.fontScale = validated.fontScale

    const updated = await prisma.language.update({
      where: { id: validated.id },
      data: updateData,
    })

    revalidatePath("/dashboard")
    revalidatePath("/browse")
    revalidatePath(`/studio/lang/${updated.slug}`)
    revalidatePath(`/studio/lang/${updated.slug}/settings`)
    revalidatePath(`/lang/${updated.slug}`)

    // Check for "first_publish" badge if visibility changed to PUBLIC
    if (validated.visibility === "PUBLIC") {
      checkLanguageBadges(userId).catch(console.error)
    }

    return {
      success: true,
      data: updated,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to update language",
    }
  }
}

export async function deleteLanguage(languageId: string) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    // Verify ownership (skip in dev mode)
    if (process.env.DEV_MODE !== "true") {
      const language = await prisma.language.findUnique({
        where: { id: languageId },
        select: { ownerId: true },
      })

      if (!language || language.ownerId !== userId) {
        return {
          error: "Unauthorized",
        }
      }
    }

    // Delete language (cascade deletion will handle related records)
    await prisma.language.delete({
      where: { id: languageId },
    })

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to delete language",
    }
  }
}
