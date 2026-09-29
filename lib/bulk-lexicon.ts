// Bulk lexicon operations: regex find/replace across a dictionary field, with a
// dry-run preview. Pure (no DB) so it unit-tests cleanly and can power both the
// preview and the apply paths.

import { isLikelyCatastrophicRegex } from "@/lib/utils/word-generator"

// A group immediately followed by an unbounded/curly quantifier — `)` then
// `*`, `+`, or `{` — is the shape EVERY exponential-backtracking regex needs
// (both nested quantifiers like `(a+)+` and overlapping alternation like
// `(a|a)+`). This runs in the shared server process (unlike the client-only
// word generator, whose weaker heuristic only hangs one tab), so we reject ALL
// quantified groups. Over-blocking a safe `(ab)+` is an acceptable trade for a
// hard ReDoS guarantee; non-grouped patterns are at worst polynomial and
// bounded by the field-length validation caps.
const QUANTIFIED_GROUP = /\)[*+{]/

function isReDoSProne(pattern: string): boolean {
  return isLikelyCatastrophicRegex(pattern) || QUANTIFIED_GROUP.test(pattern)
}

export type LexField = "lemma" | "gloss" | "ipa"
export const LEX_FIELDS: readonly LexField[] = ["lemma", "gloss", "ipa"]

export interface LexEntry {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
}

export interface FindReplaceChange {
  id: string
  before: string
  after: string
}

export interface FindReplaceResult {
  changes: FindReplaceChange[]
  error?: string
}

/**
 * Compute (without persisting) a regex find/replace over one field. Guards
 * against empty, invalid, and catastrophic-backtracking patterns. The
 * replacement supports `$1` backreferences (standard String.replace semantics).
 * Returns only the entries whose value actually changes.
 */
export const MAX_PATTERN_LENGTH = 200

/** Cheap up-front checks shared by the sync and sandboxed paths. Returns an error message or null. */
export function validateFindPattern(pattern: string, flags: string): string | null {
  if (!pattern) return "Pattern is required"
  if (pattern.length > MAX_PATTERN_LENGTH) return `Pattern is too long (max ${MAX_PATTERN_LENGTH} characters)`
  if (isReDoSProne(pattern)) {
    return "Pattern is too complex — remove quantified groups (e.g. (…)+ , (…)*)."
  }
  try {
    new RegExp(pattern, flags)
  } catch {
    return "Invalid regular expression"
  }
  return null
}

function fieldValue(e: LexEntry, field: LexField): string {
  return field === "ipa" ? e.ipa ?? "" : e[field]
}

function diff(entries: LexEntry[], field: LexField, afters: string[]): FindReplaceChange[] {
  const changes: FindReplaceChange[] = []
  entries.forEach((e, i) => {
    const before = fieldValue(e, field)
    if (afters[i] !== before) changes.push({ id: e.id, before, after: afters[i] })
  })
  return changes
}

/**
 * Synchronous version — only for trusted/bounded callers and tests. Server actions must use
 * `computeFindReplaceSandboxed`, because a validated pattern can still backtrack for seconds.
 */
export function computeFindReplace(
  entries: LexEntry[],
  field: LexField,
  pattern: string,
  replacement: string,
  opts: { caseInsensitive?: boolean } = {},
): FindReplaceResult {
  const flags = opts.caseInsensitive ? "gi" : "g"
  const error = validateFindPattern(pattern, flags)
  if (error) return { changes: [], error }
  const re = new RegExp(pattern, flags)
  return { changes: diff(entries, field, entries.map((e) => fieldValue(e, field).replace(re, replacement))) }
}

/** Same result as `computeFindReplace`, with the regex executed by `run` (e.g. a timed worker). */
export async function computeFindReplaceWith(
  run: (values: string[], pattern: string, flags: string, replacement: string) => Promise<string[]>,
  entries: LexEntry[],
  field: LexField,
  pattern: string,
  replacement: string,
  opts: { caseInsensitive?: boolean } = {},
): Promise<FindReplaceResult> {
  const flags = opts.caseInsensitive ? "gi" : "g"
  const error = validateFindPattern(pattern, flags)
  if (error) return { changes: [], error }
  try {
    const afters = await run(entries.map((e) => fieldValue(e, field)), pattern, flags, replacement)
    return { changes: diff(entries, field, afters) }
  } catch (err) {
    return { changes: [], error: err instanceof Error ? err.message : "Pattern failed to run" }
  }
}
