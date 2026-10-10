import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { canEditScope } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError, ConflictError } from "@/lib/errors"
import { assertParadigmInLanguage } from "@/lib/services/language-scope"
import { StaleRevisionError, nextRevision, parseExpectedRevision } from "@/lib/services/document-revision"
import {
  createGrammarPageSchema,
  updateGrammarPageSchema,
  type CreateGrammarPageInput,
} from "@/lib/validations/grammar-page"

/** The page fields plus the revision the editor loaded (`expectedUpdatedAt`, ISO). Omitting the
 * revision skips the check, so older clients keep working. */
const updatePageCommandSchema = updateGrammarPageSchema.extend({
  expectedUpdatedAt: z.string().nullish(),
})
export type UpdateGrammarPageCommand = z.input<typeof updatePageCommandSchema>

export async function createPage(input: CreateGrammarPageInput, userId: string) {
  const validated = createGrammarPageSchema.parse(input)

  const canEdit = await canEditScope(validated.languageId, userId, "write:grammar")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }
  await assertParadigmInLanguage(validated.paradigmId, validated.languageId)

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

export async function updatePage(input: UpdateGrammarPageCommand, userId: string) {
  const validated = updatePageCommandSchema.parse(input)
  const expected = parseExpectedRevision(validated.expectedUpdatedAt, "grammar page")

  const canEdit = await canEditScope(validated.languageId, userId, "write:grammar")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const existing = await prisma.grammarPage.findUnique({
    where: { id: validated.id },
    select: { languageId: true, slug: true, updatedAt: true },
  })

  if (!existing || existing.languageId !== validated.languageId) {
    throw new NotFoundError("Grammar page", validated.id)
  }
  await assertParadigmInLanguage(validated.paradigmId, validated.languageId)

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
  updateData.updatedAt = nextRevision(expected ?? existing.updatedAt)

  // One conditional UPDATE: with a revision, it matches only if nobody saved since the editor
  // loaded the page. Reading the row back in the same transaction returns exactly this write.
  const page = await prisma.$transaction(async (tx) => {
    const { count } = await tx.grammarPage.updateMany({
      where: { id: validated.id, languageId: validated.languageId, ...(expected && { updatedAt: expected }) },
      data: updateData,
    })
    if (count === 0) {
      if (expected && (await tx.grammarPage.count({ where: { id: validated.id } })) > 0) {
        throw new StaleRevisionError("grammar page")
      }
      throw new NotFoundError("Grammar page", validated.id)
    }
    return tx.grammarPage.findUniqueOrThrow({
      where: { id: validated.id },
      include: { language: { select: { slug: true } } },
    })
  })

  return { page, previousSlug: existing.slug }
}

export async function deletePage(pageId: string, languageId: string, userId: string) {
  const canEdit = await canEditScope(languageId, userId, "write:grammar")
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const existing = await prisma.grammarPage.findUnique({ where: { id: pageId }, select: { languageId: true } })
  if (!existing || existing.languageId !== languageId) {
    throw new NotFoundError("Grammar page", pageId)
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
  const canEdit = await canEditScope(languageId, userId, "write:grammar")
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

  // Raw updates of `order` only: Prisma would also bump `updatedAt`, which is the
  // editor's revision token, and an editor open in another tab would then report a
  // false "changed elsewhere" conflict although no content changed.
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE grammar_pages SET "order" = ${targetPage.order} WHERE id = ${pageId} AND "languageId" = ${languageId}`,
    prisma.$executeRaw`UPDATE grammar_pages SET "order" = ${page.order} WHERE id = ${targetPage.id} AND "languageId" = ${languageId}`,
  ])

  return { slug: page.language.slug }
}
