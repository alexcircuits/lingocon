import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import type { PhonemeFrequencySummary } from "./phoneme-frequency"

/**
 * Server-rendered phoneme frequency card. Renders the same markup as
 * components/phoneme-frequency-chart from a precomputed bounded summary, so neither the IPA column
 * nor the counting code is sent to the browser.
 */
export function PhonemeFrequencySummaryCard({ summary }: { summary: PhonemeFrequencySummary }) {
  const { entryCount, totalTokens, top } = summary
  if (top.length === 0) return null

  const maxCount = top[0]?.count ?? 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Phoneme Frequency
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Distribution of phonemes across {entryCount} transcribed dictionary entries
          ({totalTokens.toLocaleString()} total tokens)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {top.map(({ phoneme, count }) => {
            const pct = Math.round((count / totalTokens) * 100 * 10) / 10
            const barW = Math.round((count / maxCount) * 100)
            return (
              <div key={phoneme} className="flex items-center gap-3">
                <span className="font-mono text-sm w-8 shrink-0 text-right text-foreground">
                  /{phoneme}/
                </span>
                <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden relative">
                  <div
                    className="h-full bg-primary/70 rounded transition-all"
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 shrink-0">
                  {count.toLocaleString()} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
