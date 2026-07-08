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
export function computeFindReplace(
  entries: LexEntry[],
  field: LexField,
  pattern: string,
  replacement: string,
  opts: { caseInsensitive?: boolean } = {},
): FindReplaceResult {
  if (!pattern) return { changes: [], error: "Pattern is required" }
  if (isReDoSProne(pattern)) {
    return { changes: [], error: "Pattern is too complex — remove quantified groups (e.g. (…)+ , (…)*)." }
  }

  let re: RegExp
  try {
    re = new RegExp(pattern, opts.caseInsensitive ? "gi" : "g")
  } catch {
    return { changes: [], error: "Invalid regular expression" }
  }

  const changes: FindReplaceChange[] = []
  for (const e of entries) {
    const before = field === "ipa" ? e.ipa ?? "" : e[field]
    const after = before.replace(re, replacement)
    if (after !== before) changes.push({ id: e.id, before, after })
  }
  return { changes }
}
