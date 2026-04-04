"use server"

import { ZodError } from "zod"
import { getUserId } from "@/lib/auth-helpers"
import { AppError } from "@/lib/errors"
import { revalidateAlphabet } from "@/lib/utils/revalidation"
import { checkScriptBadges } from "@/app/actions/badge"
import type { CreateScriptSymbolInput, UpdateScriptSymbolInput } from "@/lib/validations/script-symbol"
import * as symbolService from "@/lib/services/script-symbol"

function handleError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) return { error: error.issues[0]?.message || "Validation failed" }
  if (error instanceof AppError) return { error: error.message }
  if (error instanceof Error) return { error: error.message }
  return { error: fallbackMessage }
}

export async function createScriptSymbol(input: CreateScriptSymbolInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const symbol = await symbolService.createSymbol(input, userId)
    revalidateAlphabet(symbol.language.slug)
    checkScriptBadges(userId, input.languageId).catch(console.error)
    return { success: true as const, data: symbol }
  } catch (error) {
    return handleError(error, "Failed to create script symbol")
  }
}

export async function updateScriptSymbol(input: UpdateScriptSymbolInput) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const symbol = await symbolService.updateSymbol(input, userId)
    revalidateAlphabet(symbol.language.slug)
    return { success: true as const, data: symbol }
  } catch (error) {
    return handleError(error, "Failed to update script symbol")
  }
}

export async function deleteScriptSymbol(symbolId: string, languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const symbol = await symbolService.deleteSymbol(symbolId, languageId, userId)
    revalidateAlphabet(symbol.language.slug)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to delete script symbol")
  }
}

export async function reorderScriptSymbols(
  symbolId: string,
  languageId: string,
  direction: "up" | "down"
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await symbolService.reorderSymbols(symbolId, languageId, direction, userId)
    revalidateAlphabet(result.slug)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to reorder script symbols")
  }
}

export async function saveAlphabetOrder(symbolIds: string[], languageId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const result = await symbolService.saveAlphabetOrder(symbolIds, languageId, userId)
    if (result.slug) revalidateAlphabet(result.slug)
    return { success: true as const }
  } catch (error) {
    return handleError(error, "Failed to save alphabet order")
  }
}
