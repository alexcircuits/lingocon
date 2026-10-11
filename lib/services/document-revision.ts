/**
 * Optimistic concurrency for documents edited as a whole in the studio (articles, texts, grammar
 * pages). The editor sends the `updatedAt` it loaded as `expectedUpdatedAt`; the service writes only
 * if the row still has that revision (one conditional UPDATE … WHERE "updatedAt" = $expected, which
 * Postgres re-checks after waiting for a concurrent writer's row lock), so a stale tab or a
 * collaborator's older copy can no longer silently overwrite newer content.
 *
 * Requests without `expectedUpdatedAt` (older clients, scripts) keep working: no check.
 */
import { ConflictError, ValidationError, toActionError } from "@/lib/errors"

/** A save prepared against an older stored revision. Nothing was written. */
export class StaleRevisionError extends ConflictError {
  constructor(documentLabel: string) {
    super(`This ${documentLabel} changed since you opened it. Reload the latest version before saving again.`)
    this.name = "StaleRevisionError"
  }
}

/** Parses the optional client revision; absent means "no check". A malformed one is rejected
 * rather than skipped, so a client bug cannot quietly disable the check. */
export function parseExpectedRevision(value: unknown, documentLabel: string): Date | null {
  if (value === undefined || value === null) return null
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN
  if (Number.isNaN(time)) throw new ValidationError(`Invalid ${documentLabel} revision`)
  return new Date(time)
}

/** The revision a save writes: strictly after the previous one, so two saves within one
 * millisecond (or a lagging server clock) never reproduce a revision a stale tab still holds. */
export function nextRevision(previous: Date): Date {
  return new Date(Math.max(Date.now(), previous.getTime() + 1))
}

export interface DocumentSaveError {
  error: string
  /** Set when the save lost to a newer revision: the editor keeps the draft and offers a reload. */
  conflict?: true
}

/** `toActionError`, plus a distinct `conflict` flag for stale-revision saves. */
export function toDocumentSaveError(error: unknown, fallbackMessage: string): DocumentSaveError {
  if (error instanceof StaleRevisionError) return { error: error.message, conflict: true }
  return toActionError(error, fallbackMessage)
}
