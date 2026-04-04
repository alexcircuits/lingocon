import { ZodError } from "zod"
import { getUserId } from "@/lib/auth-helpers"
import { AppError } from "@/lib/errors"
import type { ActionResult } from "@/lib/types"

/**
 * Wraps a server action handler with authentication and standardized error handling.
 *
 * Eliminates the duplicated pattern of:
 * 1. Check auth (getUserId)
 * 2. Try/catch with ZodError handling
 * 3. Return { success, data } or { error }
 *
 * @example
 * ```ts
 * export const createEntry = withAuth(async (input: CreateInput, userId: string) => {
 *   const validated = createSchema.parse(input)
 *   // ... business logic
 *   return entry
 * })
 * ```
 */
export function withAuth<TInput, TOutput>(
  handler: (input: TInput, userId: string) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    const userId = await getUserId()
    if (!userId) {
      return { error: "Unauthorized" }
    }

    try {
      const data = await handler(input, userId)
      return { success: true, data } as ActionResult<TOutput>
    } catch (error) {
      if (error instanceof ZodError) {
        return { error: error.issues[0]?.message || "Validation failed" }
      }
      if (error instanceof AppError) {
        return { error: error.message }
      }
      if (error instanceof Error) {
        console.error(`Action error: ${error.message}`, error)
        return { error: error.message }
      }
      console.error("Unexpected action error:", error)
      return { error: "An unexpected error occurred" }
    }
  }
}

/**
 * Like withAuth but for actions that take multiple arguments.
 * Useful for actions like `deleteEntry(entryId, languageId)`.
 *
 * @example
 * ```ts
 * export const deleteEntry = withAuthArgs(
 *   async (args: { entryId: string; languageId: string }, userId: string) => {
 *     // ... business logic
 *   }
 * )
 * ```
 */
export function withAuthArgs<TArgs, TOutput>(
  handler: (args: TArgs, userId: string) => Promise<TOutput>
): (args: TArgs) => Promise<ActionResult<TOutput>> {
  return withAuth(handler)
}

/**
 * Wraps a handler that does not require authentication.
 * Still provides standardized error handling.
 */
export function withErrorHandling<TInput, TOutput>(
  handler: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    try {
      const data = await handler(input)
      return { success: true, data } as ActionResult<TOutput>
    } catch (error) {
      if (error instanceof ZodError) {
        return { error: error.issues[0]?.message || "Validation failed" }
      }
      if (error instanceof AppError) {
        return { error: error.message }
      }
      if (error instanceof Error) {
        console.error(`Action error: ${error.message}`, error)
        return { error: error.message }
      }
      console.error("Unexpected action error:", error)
      return { error: "An unexpected error occurred" }
    }
  }
}
