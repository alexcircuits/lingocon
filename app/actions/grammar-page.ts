"use server"

import { ZodError } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import {
  createGrammarPageSchema,
  updateGrammarPageSchema,
  type CreateGrammarPageInput,
  type UpdateGrammarPageInput,
} from "@/lib/validations/grammar-page"

export async function createGrammarPage(input: CreateGrammarPageInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = createGrammarPageSchema.parse(input)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    // Check if slug already exists for this language
    const existing = await prisma.grammarPage.findUnique({
      where: {
        languageId_slug: {
          languageId: validated.languageId,
          slug: validated.slug,
        },
      },
    })

    if (existing) {
      return {
        error: "A grammar page with this slug already exists",
      }
    }

    const page = await prisma.grammarPage.create({
      data: {
        title: validated.title,
        slug: validated.slug,
        content: validated.content,
        imageUrl: validated.imageUrl || null,
        order: validated.order,
        paradigmId: validated.paradigmId || null,
        languageId: validated.languageId,
      },
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    revalidatePath(`/studio/lang/${page.language.slug}/grammar`)
    revalidatePath(`/lang/${page.language.slug}/grammar`)

    return {
      success: true,
      data: page,
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
      error: "Failed to create grammar page",
    }
  }
}

export async function updateGrammarPage(input: UpdateGrammarPageInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = updateGrammarPageSchema.parse(input)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    // Get existing page
    const existing = await prisma.grammarPage.findUnique({
      where: { id: validated.id },
      select: { languageId: true, slug: true },
    })

    if (!existing) {
      return {
        error: "Grammar page not found",
      }
    }

    // If slug is being changed, check for conflicts
    if (validated.slug && validated.slug !== existing.slug) {
      const conflict = await prisma.grammarPage.findUnique({
        where: {
          languageId_slug: {
            languageId: validated.languageId,
            slug: validated.slug,
          },
        },
      })

      if (conflict) {
        return {
          error: "A grammar page with this slug already exists",
        }
      }
    }

    const updateData: any = {}
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.slug !== undefined) updateData.slug = validated.slug
    if (validated.content !== undefined) updateData.content = validated.content
    if (validated.imageUrl !== undefined) updateData.imageUrl = validated.imageUrl || null
    if (validated.order !== undefined) updateData.order = validated.order
    if (validated.paradigmId !== undefined) updateData.paradigmId = validated.paradigmId || null

    const page = await prisma.grammarPage.update({
      where: { id: validated.id },
      data: updateData,
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    revalidatePath(`/studio/lang/${page.language.slug}/grammar`)
    revalidatePath(`/studio/lang/${page.language.slug}/grammar/${page.slug}`)
    revalidatePath(`/lang/${page.language.slug}/grammar`)
    revalidatePath(`/lang/${page.language.slug}/grammar/${page.slug}`)

    return {
      success: true,
      data: page,
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
      error: "Failed to update grammar page",
    }
  }
}

export async function deleteGrammarPage(pageId: string, languageId: string) {
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

    const page = await prisma.grammarPage.delete({
      where: { id: pageId },
      include: {
        language: {
          select: { slug: true }
        }
      }
    })

    revalidatePath(`/studio/lang/${page.language.slug}/grammar`)
    revalidatePath(`/lang/${page.language.slug}/grammar`)

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
      error: "Failed to delete grammar page",
    }
  }
}

export async function reorderGrammarPages(
  pageId: string,
  languageId: string,
  direction: "up" | "down"
) {
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

    const page = await prisma.grammarPage.findUnique({
      where: { id: pageId },
      select: { order: true, language: { select: { slug: true } } },
    })

    if (!page) {
      return {
        error: "Grammar page not found",
      }
    }

    const allPages = await prisma.grammarPage.findMany({
      where: { languageId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    })

    const currentIndex = allPages.findIndex((p) => p.id === pageId)
    if (currentIndex === -1) {
      return {
        error: "Grammar page not found",
      }
    }

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

    if (newIndex < 0 || newIndex >= allPages.length) {
      return {
        error: "Cannot move page in that direction",
      }
    }

    const targetPage = allPages[newIndex]

    // Swap orders
    await prisma.$transaction([
      prisma.grammarPage.update({
        where: { id: pageId },
        data: { order: targetPage.order },
      }),
      prisma.grammarPage.update({
        where: { id: targetPage.id },
        data: { order: page.order },
      }),
    ])

    revalidatePath(`/studio/lang/${page.language.slug}/grammar`)
    revalidatePath(`/lang/${page.language.slug}/grammar`)

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
      error: "Failed to reorder grammar pages",
    }
  }
}


