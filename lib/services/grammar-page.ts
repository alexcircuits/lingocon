import { prisma } from "@/lib/prisma"
import { canEditLanguage } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError, ConflictError } from "@/lib/errors"
import {
  createGrammarPageSchema,
  updateGrammarPageSchema,
  type CreateGrammarPageInput,
  type UpdateGrammarPageInput,
} from "@/lib/validations/grammar-page"

export async function createPage(input: CreateGrammarPageInput, userId: string) {
  const validated = createGrammarPageSchema.parse(input)

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const existing = await prisma.grammarPage.findUnique({
    where: {
      languageId_slug: {
        languageId: validated.languageId,
        slug: validated.slug,
      },
    },
  })

  if (existing) {
    throw new ConflictError("A grammar page with this slug already exists")
  }

  return prisma.grammarPage.create({
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
      language: { select: { slug: true } },
    },
  })
}

export async function updatePage(input: UpdateGrammarPageInput, userId: string) {
  const validated = updateGrammarPageSchema.parse(input)

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const existing = await prisma.grammarPage.findUnique({
    where: { id: validated.id },
    select: { languageId: true, slug: true },
  })

  if (!existing) {
    throw new NotFoundError("Grammar page", validated.id)
  }

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
      throw new ConflictError("A grammar page with this slug already exists")
    }
  }

  const updateData: Record<string, unknown> = {}
  if (validated.title !== undefined) updateData.title = validated.title
  if (validated.slug !== undefined) updateData.slug = validated.slug
  if (validated.content !== undefined) updateData.content = validated.content
  if (validated.imageUrl !== undefined) updateData.imageUrl = validated.imageUrl || null
  if (validated.order !== undefined) updateData.order = validated.order
  if (validated.paradigmId !== undefined) updateData.paradigmId = validated.paradigmId || null

  return prisma.grammarPage.update({
    where: { id: validated.id },
    data: updateData,
    include: {
      language: { select: { slug: true } },
    },
  })
}

export async function deletePage(pageId: string, languageId: string, userId: string) {
  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  return prisma.grammarPage.delete({
    where: { id: pageId },
    include: {
      language: { select: { slug: true } },
    },
  })
}

export async function reorderPages(
  pageId: string,
  languageId: string,
  direction: "up" | "down",
  userId: string
) {
  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const page = await prisma.grammarPage.findUnique({
    where: { id: pageId },
    select: { order: true, language: { select: { slug: true } } },
  })

  if (!page) {
    throw new NotFoundError("Grammar page", pageId)
  }

  const allPages = await prisma.grammarPage.findMany({
    where: { languageId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  })

  const currentIndex = allPages.findIndex((p) => p.id === pageId)
  if (currentIndex === -1) {
    throw new NotFoundError("Grammar page", pageId)
  }

  const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

  if (newIndex < 0 || newIndex >= allPages.length) {
    throw new ConflictError("Cannot move page in that direction")
  }

  const targetPage = allPages[newIndex]

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

  return { slug: page.language.slug }
}
