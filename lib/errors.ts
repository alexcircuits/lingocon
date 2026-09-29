/**
 * Base application error with a machine-readable code.
 * Services throw these; the action wrapper translates them to ActionResult.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "You don't have permission to perform this action") {
    super("UNAUTHORIZED", message)
    this.name = "UnauthorizedError"
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    const message = id ? `${entity} with id "${id}" not found` : `${entity} not found`
    super("NOT_FOUND", message)
    this.name = "NotFoundError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message)
    this.name = "ValidationError"
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message)
    this.name = "ConflictError"
  }
}

/**
 * The one way Server Actions turn a caught error into `{ error }` for the browser.
 *
 * Validation and domain errors (ZodError, AppError) carry messages written for users. Anything else
 * — Prisma errors with table/column names, driver errors, bugs — is logged server-side and replaced
 * with `fallbackMessage`, so internals never reach the client.
 *
 * Return it as `{ ...toActionError(error, "…") }` from actions whose callers read `result.error` on
 * the success/error union: the spread keeps TypeScript's object-literal union normalization.
 */
export function toActionError(error: unknown, fallbackMessage: string): { error: string } {
  if (error instanceof AppError) return { error: error.message }
  if (isZodError(error)) return { error: error.issues[0]?.message || "Validation failed" }
  const code = (error as { code?: unknown } | null)?.code
  if (code === "P2002") return { error: "That already exists — please choose a different value." }
  if (code === "P2025") return { error: "Not found — it may have been deleted." }
  console.error(`[action] ${fallbackMessage}:`, error)
  return { error: fallbackMessage }
}

function isZodError(error: unknown): error is { issues: { message: string }[] } {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "ZodError" &&
    Array.isArray((error as { issues?: unknown }).issues)
  )
}
