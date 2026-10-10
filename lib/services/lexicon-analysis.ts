import "server-only"
import { prisma } from "@/lib/prisma"
import { requestCache } from "@/lib/request-cache"
import { canViewLanguage, getUserId } from "@/lib/auth-helpers"
import { getLexiconAnalysis as getLexiconAnalysisFromService, type LexiconAnalysis } from "@/lib/rust-api"
import { getValidationWarnings } from "@/lib/utils/validation"
import { matchSwadeshList } from "@/lib/data/swadesh-list"

export type { LexiconAnalysis }

/** Warnings are rendered client-side; a large lexicon could produce thousands. */
export const MAX_WARNINGS_SHOWN = 50

/** The whole-lexicon analysis in Node: what the Rust service computes, used when it is off. */
async function computeLexiconAnalysis(languageId: string, allowsDiacritics: boolean): Promise<LexiconAnalysis> {
  const [symbols, entries, paradigms] = await Promise.all([
    prisma.scriptSymbol.findMany({ where: { languageId }, select: { symbol: true, capitalSymbol: true } }),
    // Ordered by id: which 50 warnings are shown must not depend on physical row
    // order (and must match the Rust implementation, which reads in the same order).
    prisma.dictionaryEntry.findMany({ where: { languageId }, select: { lemma: true, gloss: true, paradigmId: true }, orderBy: { id: "asc" } }),
    prisma.paradigm.findMany({ where: { languageId }, select: { id: true } }),
  ])
  const allWarnings = getValidationWarnings(symbols, entries, paradigms, { allowsDiacritics })
  const { matched } = matchSwadeshList(entries.map((entry) => entry.gloss))
  return {
    warnings: allWarnings.slice(0, MAX_WARNINGS_SHOWN),
    total: allWarnings.length,
    matchedIds: Array.from(matched).sort((a, b) => a - b),
  }
}

/**
 * The studio layout already checks access. The Rust service trusts whoever holds
 * its token, so the check is repeated right next to the call rather than relying
 * on the layout (same rules as the layout; `getUserId` is cached per request).
 */
async function canViewAnalysis(languageId: string): Promise<boolean> {
  if (process.env.DEV_MODE === "true") return true
  const userId = await getUserId()
  return userId !== null && (await canViewLanguage(languageId, userId))
}

/**
 * Validation warnings (first 50 + total) and Swadesh coverage for the studio
 * overview. Served by the Rust service when it is configured
 * (docs/RUST_SERVICE.md), otherwise — or when it is unavailable — computed here.
 * `null` when the current user may not view the language.
 */
export const getOverviewLexiconAnalysis = requestCache(async function getOverviewLexiconAnalysis(
  languageId: string,
  allowsDiacritics: boolean
): Promise<LexiconAnalysis | null> {
  if (!(await canViewAnalysis(languageId))) return null
  return (await getLexiconAnalysisFromService(languageId)) ?? computeLexiconAnalysis(languageId, allowsDiacritics)
})
