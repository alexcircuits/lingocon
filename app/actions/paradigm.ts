"use server"

import { ZodError } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import {
  createParadigmSchema,
  updateParadigmSchema,
  type CreateParadigmInput,
  type UpdateParadigmInput,
} from "@/lib/validations/paradigm"

export async function createParadigm(input: CreateParadigmInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = createParadigmSchema.parse(input)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const paradigm = await prisma.paradigm.create({
      data: {
        name: validated.name,
        slots: validated.slots as any,
        notes: validated.notes || null,
        languageId: validated.languageId,
      },
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    revalidatePath(`/studio/lang/${paradigm.language.slug}/grammar`)
    revalidatePath(`/lang/${paradigm.language.slug}/grammar`)

    return {
      success: true,
      data: paradigm,
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
      error: "Failed to create paradigm",
    }
  }
}

export async function updateParadigm(input: UpdateParadigmInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = updateParadigmSchema.parse(input)

    const paradigm = await prisma.paradigm.findUnique({
      where: { id: validated.id },
      include: { language: { select: { slug: true } } },
    })

    if (!paradigm) {
      return {
        error: "Paradigm not found",
      }
    }

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(paradigm.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.slots !== undefined) updateData.slots = validated.slots as any
    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    const updated = await prisma.paradigm.update({
      where: { id: validated.id },
      data: updateData,
    })

    revalidatePath(`/studio/lang/${paradigm.language.slug}/grammar`)
    revalidatePath(`/lang/${paradigm.language.slug}/grammar`)

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
      error: "Failed to update paradigm",
    }
  }
}

export async function deleteParadigm(paradigmId: string, languageId: string) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const paradigm = await prisma.paradigm.delete({
      where: { id: paradigmId },
      include: { language: { select: { slug: true } } },
    })

    revalidatePath(`/studio/lang/${paradigm.language.slug}/grammar`)
    revalidatePath(`/lang/${paradigm.language.slug}/grammar`)

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
      error: "Failed to delete paradigm",
    }
  }
}

export async function getParadigmsForLanguage(languageId: string) {
  try {
    const paradigms = await prisma.paradigm.findMany({
      where: { languageId },
      select: {
        id: true,
        name: true,
        notes: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return {
      success: true,
      data: paradigms,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to fetch paradigms",
    }
  }
}

export async function getParadigmById(paradigmId: string) {
  try {
    const paradigm = await prisma.paradigm.findUnique({
      where: { id: paradigmId },
      select: {
        id: true,
        name: true,
        slots: true,
        notes: true,
      },
    })

    if (!paradigm) {
      return {
        error: "Paradigm not found",
      }
    }

    return {
      success: true,
      data: paradigm,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to fetch paradigm",
    }
  }
}


