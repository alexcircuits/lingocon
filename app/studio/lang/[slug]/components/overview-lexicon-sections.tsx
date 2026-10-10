import { getOverviewLexiconAnalysis, type LexiconAnalysis } from "@/lib/services/lexicon-analysis"
import { ValidationWarnings } from "@/components/validation-warnings"
import { SwadeshTracker } from "@/components/analytics/swadesh-tracker"

/**
 * Validation warnings and Swadesh coverage need the whole lexicon. Computed once
 * per request on the server (both sections share it; by the Rust service when it
 * is configured) and streamed in behind Suspense, so the rest of the overview
 * renders immediately and the browser receives 50 warnings and the matched
 * concept IDs instead of every gloss.
 */
async function settle(languageId: string, allowsDiacritics: boolean): Promise<LexiconAnalysis | null> {
  try {
    return await getOverviewLexiconAnalysis(languageId, allowsDiacritics)
  } catch (error) {
    // Hide just these sections instead of failing the whole overview.
    console.error("[overview] lexicon analysis unavailable", error)
    return null
  }
}

interface SectionProps {
  languageId: string
  allowsDiacritics: boolean
}

export async function OverviewWarnings({ languageId, allowsDiacritics }: SectionProps) {
  const analysis = await settle(languageId, allowsDiacritics)
  if (!analysis || analysis.warnings.length === 0) return null
  return <ValidationWarnings warnings={analysis.warnings} total={analysis.total} scopeKey={languageId} />
}

export async function OverviewSwadesh({ languageId, allowsDiacritics }: SectionProps) {
  const analysis = await settle(languageId, allowsDiacritics)
  if (!analysis) return null
  return <SwadeshTracker matchedIds={analysis.matchedIds} />
}
