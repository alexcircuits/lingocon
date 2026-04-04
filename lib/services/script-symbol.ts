import { prisma } from "@/lib/prisma"
import { canEditLanguage } from "@/lib/auth-helpers"
import { UnauthorizedError, NotFoundError, ConflictError, ValidationError } from "@/lib/errors"
import {
  createScriptSymbolSchema,
  updateScriptSymbolSchema,
  type CreateScriptSymbolInput,
  type UpdateScriptSymbolInput,
} from "@/lib/validations/script-symbol"

export async function createSymbol(input: CreateScriptSymbolInput, userId: string) {
  const validated = createScriptSymbolSchema.parse(input)

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  return prisma.scriptSymbol.create({
    data: {
      symbol: validated.symbol,
      capitalSymbol: validated.capitalSymbol || null,
      ipa: validated.ipa || null,
      latin: validated.latin || null,
      name: validated.name || null,
      order: validated.order,
      languageId: validated.languageId,
    },
    include: {
      language: { select: { slug: true } },
    },
  })
}

export async function updateSymbol(input: UpdateScriptSymbolInput, userId: string) {
  const validated = updateScriptSymbolSchema.parse(input)

  const canEdit = await canEditLanguage(validated.languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  return prisma.scriptSymbol.update({
    where: { id: validated.id },
    data: {
      symbol: validated.symbol,
      capitalSymbol: validated.capitalSymbol || null,
      ipa: validated.ipa || null,
      latin: validated.latin || null,
      name: validated.name || null,
      order: validated.order,
    },
    include: {
      language: { select: { slug: true } },
    },
  })
}

export async function deleteSymbol(symbolId: string, languageId: string, userId: string) {
  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  return prisma.scriptSymbol.delete({
    where: { id: symbolId },
    include: {
      language: { select: { slug: true } },
    },
  })
}

export async function reorderSymbols(
  symbolId: string,
  languageId: string,
  direction: "up" | "down",
  userId: string
) {
  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const symbol = await prisma.scriptSymbol.findUnique({
    where: { id: symbolId },
    select: { order: true, language: { select: { slug: true } } },
  })

  if (!symbol) {
    throw new NotFoundError("Symbol", symbolId)
  }

  const allSymbols = await prisma.scriptSymbol.findMany({
    where: { languageId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  })

  const currentIndex = allSymbols.findIndex((s) => s.id === symbolId)
  if (currentIndex === -1) {
    throw new NotFoundError("Symbol", symbolId)
  }

  const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

  if (newIndex < 0 || newIndex >= allSymbols.length) {
    throw new ConflictError("Cannot move symbol in that direction")
  }

  const targetSymbol = allSymbols[newIndex]

  await prisma.$transaction([
    prisma.scriptSymbol.update({
      where: { id: symbolId },
      data: { order: targetSymbol.order },
    }),
    prisma.scriptSymbol.update({
      where: { id: targetSymbol.id },
      data: { order: symbol.order },
    }),
  ])

  return { slug: symbol.language.slug }
}

export async function saveAlphabetOrder(
  symbolIds: string[],
  languageId: string,
  userId: string
) {
  if (symbolIds.length > 1000) {
    throw new ValidationError("Too many symbols to reorder at once (max 1000)")
  }

  const canEdit = await canEditLanguage(languageId, userId)
  if (!canEdit) {
    throw new UnauthorizedError("You don't have permission to edit this language")
  }

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { slug: true },
  })

  await prisma.$transaction(
    symbolIds.map((id, index) =>
      prisma.scriptSymbol.update({
        where: { id },
        data: { order: index },
      })
    )
  )

  return { slug: language?.slug }
}
