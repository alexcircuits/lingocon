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
