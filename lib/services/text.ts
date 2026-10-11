/**
 * `Text` records (long-form writing attached to a language): create, update, delete.
 *
 * Authorization is "write:texts" via `canEditScope` (owners, editors with that permission, admins).
 * Slugs are derived from the title and unique per `languageId`; a title change regenerates the slug.
 * Texts are always saved as published (there is no draft workflow for texts).
 */
import { TextType, type Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { canEditScope } from "@/lib/auth-helpers"
import { NotFoundError, UnauthorizedError } from "@/lib/errors"
import { slugOrFallback } from "@/lib/utils/slug"
import { mediaUrlSchema } from "@/lib/validations/url"
import { assertParadigmInLanguage } from "@/lib/services/language-scope"
import { StaleRevisionError, nextRevision, parseExpectedRevision } from "@/lib/services/document-revision"

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

export interface CreateTextInput {
  title: string
  description?: string | null
  type: TextType
  content?: unknown
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  coverImage?: string | null
  /** Ignored: texts are always published. Accepted so older clients keep working. */
  published?: boolean
  paradigmId?: string | null
  languageId: string
}

export type UpdateTextInput = Partial<Omit<CreateTextInput, "languageId">> & {
  /** The `updatedAt` the editor loaded (ISO). Omitted: no revision check. */
  expectedUpdatedAt?: string | null
}

/** URL-safe slug derived from a title; not globally unique — uniqueness is enforced per language. */
function textSlug(title: string): string {
  return slugOrFallback(title, "text", 50)
}

async function uniqueTextSlug(languageId: string, title: string, excludeId?: string): Promise<string> {
  const baseSlug = textSlug(title)
  let slug = baseSlug
  let counter = 1
  while (
    await prisma.text.findFirst({
      where: { languageId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${counter++}`
  }
  return slug
}

/** Same message the action has always returned for a paradigm from another language. */
async function assertParadigm(paradigmId: string | null | undefined, languageId: string) {
  try {
    await assertParadigmInLanguage(paradigmId, languageId)
  } catch {
    throw new NotFoundError("Paradigm")
  }
}

export async function createText(input: CreateTextInput, userId: string) {
  if (!(await canEditScope(input.languageId, userId, "write:texts"))) {
    throw new UnauthorizedError("You don't have permission to add texts to this language")
  }

  const fields = textFieldsSchema.parse(input)
  await assertParadigm(fields.paradigmId, input.languageId)

  const langSlug = (
    await prisma.language.findUnique({ where: { id: input.languageId }, select: { slug: true } })
  )?.slug

  const slug = await uniqueTextSlug(input.languageId, fields.title)
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
      languageId: input.languageId,
      authorId: userId,
    },
  })

  return { text, langSlug }
}

export async function updateText(id: string, data: UpdateTextInput, userId: string) {
  const { expectedUpdatedAt, ...input } = data
  const expected = parseExpectedRevision(expectedUpdatedAt, "text")

  const text = await prisma.text.findUnique({
    where: { id },
    include: { language: { select: { slug: true, id: true } } },
  })
  if (!text) throw new NotFoundError("Text")

  if (!(await canEditScope(text.language.id, userId, "write:texts"))) {
    throw new UnauthorizedError("You don't have permission to edit this text")
  }

  const fields = textUpdateSchema.parse(input)
  await assertParadigm(fields.paradigmId, text.languageId)

  const slug = fields.title && fields.title !== text.title
    ? await uniqueTextSlug(text.languageId, fields.title, id)
    : text.slug

  // One conditional UPDATE: with a revision, it matches only if nobody saved since the editor
  // loaded the text. Reading the row back in the same transaction returns exactly this write.
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.text.updateMany({
      where: { id, languageId: text.languageId, ...(expected && { updatedAt: expected }) },
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
        updatedAt: nextRevision(expected ?? text.updatedAt),
      },
    })
    if (count === 0) {
      if (expected && (await tx.text.count({ where: { id } })) > 0) throw new StaleRevisionError("text")
      throw new NotFoundError("Text")
    }
    return tx.text.findUniqueOrThrow({ where: { id } })
  })

  return { text: updated, langSlug: text.language.slug, previousSlug: text.slug }
}

export async function deleteText(id: string, userId: string) {
  const text = await prisma.text.findUnique({
    where: { id },
    include: { language: { select: { slug: true, id: true } } },
  })
  if (!text) throw new NotFoundError("Text")

  if (!(await canEditScope(text.language.id, userId, "write:texts"))) {
    throw new UnauthorizedError("You don't have permission to delete this text")
  }

  await prisma.text.delete({ where: { id } })
  return { langSlug: text.language.slug, textSlug: text.slug }
}
