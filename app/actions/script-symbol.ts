"use server"

import { ZodError } from "zod"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import {
  createScriptSymbolSchema,
  updateScriptSymbolSchema,
  type CreateScriptSymbolInput,
  type UpdateScriptSymbolInput,
} from "@/lib/validations/script-symbol"

export async function createScriptSymbol(input: CreateScriptSymbolInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = createScriptSymbolSchema.parse(input)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const symbol = await prisma.scriptSymbol.create({
      data: {
        symbol: validated.symbol,
        capitalSymbol: validated.capitalSymbol || null,
        ipa: validated.ipa || null,
        latin: validated.latin || null,
        name: validated.name || null,
        order: validated.order,
        languageId: validated.languageId,
      },
    })

    return {
      success: true,
      data: symbol,
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
      error: "Failed to create script symbol",
    }
  }
}

export async function updateScriptSymbol(input: UpdateScriptSymbolInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    const validated = updateScriptSymbolSchema.parse(input)

    // Verify edit permission (owner or editor)
    const canEdit = await canEditLanguage(validated.languageId, userId)
    if (!canEdit) {
      return {
        error: "Unauthorized - You don't have permission to edit this language",
      }
    }

    const symbol = await prisma.scriptSymbol.update({
      where: { id: validated.id },
      data: {
        symbol: validated.symbol,
        capitalSymbol: validated.capitalSymbol || null,
        ipa: validated.ipa || null,
        latin: validated.latin || null,
        name: validated.name || null,
        order: validated.order,
      },
    })

    return {
      success: true,
      data: symbol,
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
      error: "Failed to update script symbol",
    }
  }
}

export async function deleteScriptSymbol(symbolId: string, languageId: string) {
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

    await prisma.scriptSymbol.delete({
      where: { id: symbolId },
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
      error: "Failed to delete script symbol",
    }
  }
}

export async function reorderScriptSymbols(
  symbolId: string,
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

    const symbol = await prisma.scriptSymbol.findUnique({
      where: { id: symbolId },
      select: { order: true },
    })

    if (!symbol) {
      return {
        error: "Symbol not found",
      }
    }

    const allSymbols = await prisma.scriptSymbol.findMany({
      where: { languageId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    })

    const currentIndex = allSymbols.findIndex((s) => s.id === symbolId)
    if (currentIndex === -1) {
      return {
        error: "Symbol not found",
      }
    }

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

    if (newIndex < 0 || newIndex >= allSymbols.length) {
      return {
        error: "Cannot move symbol in that direction",
      }
    }

    const targetSymbol = allSymbols[newIndex]

    // Swap orders
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
      error: "Failed to reorder script symbols",
    }
  }
}

