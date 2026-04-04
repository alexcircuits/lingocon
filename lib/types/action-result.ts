/**
 * Discriminated union for server action return values.
 *
 * Success case always includes `success: true` and optional typed `data`.
 * Error case always includes `error: string`.
 *
 * @example
 * ```ts
 * // Action returning data
 * async function createEntry(input: Input): Promise<ActionResult<DictionaryEntry>> {
 *   return { success: true, data: entry }
 * }
 *
 * // Action returning void
 * async function deleteEntry(id: string): Promise<ActionResult> {
 *   return { success: true }
 * }
 *
 * // Error
 * return { error: "Not found" }
 * ```
 */
export type ActionResult<T = void> =
  | (T extends void
      ? { success: true; error?: never }
      : { success: true; data: T; error?: never })
  | { success?: never; error: string }
