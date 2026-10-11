import "server-only"
import { z } from "zod"
import type { ValidationWarning } from "@/lib/utils/validation"
import { postInternal } from "./client"

/** The service returns at most this many warnings (main's `MAX_WARNINGS_SHOWN`). */
export const MAX_WARNINGS = 50
// Generous bounds: anything larger is a bug, not data worth rendering.
const MAX_MESSAGE_LENGTH = 20_000
const MAX_MATCHED_IDS = 10_000

const warningSchema = z.object({
  type: z.enum(["undefined_symbol", "missing_entry", "unused_symbol", "missing_paradigm"]),
  message: z.string().max(MAX_MESSAGE_LENGTH),
  severity: z.enum(["warning", "info"]),
})

export const lexiconAnalysisSchema = z
  .object({
    warnings: z.array(warningSchema).max(MAX_WARNINGS),
    total: z.number().int().nonnegative(),
    matchedIds: z.array(z.number().int().nonnegative()).max(MAX_MATCHED_IDS),
  })
  .refine((analysis) => analysis.total >= analysis.warnings.length, {
    message: "total must count at least the returned warnings",
  })

/** Same shape the studio overview computes in TypeScript. */
export interface LexiconAnalysis {
  warnings: ValidationWarning[]
  total: number
  matchedIds: number[]
}

/**
 * Validation warnings (first 50 + total) and matched Swadesh concept ids for a
 * language, computed by the Rust service.
 *
 * The service trusts Next: call this only after authorizing the current user for
 * `languageId`. Returns `null` when the service is not configured or unavailable;
 * the caller then computes the same result in TypeScript.
 */
export async function getLexiconAnalysis(languageId: string): Promise<LexiconAnalysis | null> {
  return postInternal("/v1/internal/lexicon-analysis", { languageId }, lexiconAnalysisSchema, {
    languageId,
  })
}
