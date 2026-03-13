"use client"

import { useState, useTransition } from "react"
import { compareLanguages } from "@/app/actions/compare-languages"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GitCompareArrows, Loader2, ArrowLeftRight } from "lucide-react"

interface LanguageOption {
  id: string
  name: string
  slug: string
}

interface CompareModalProps {
  languages: LanguageOption[]
  isOpen: boolean
  onClose: () => void
}

type CompareResult = Awaited<ReturnType<typeof compareLanguages>>

export function CompareModal({ languages, isOpen, onClose }: CompareModalProps) {
  const [langA, setLangA] = useState("")
  const [langB, setLangB] = useState("")
  const [result, setResult] = useState<CompareResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCompare = () => {
    if (!langA || !langB || langA === langB) return
    startTransition(async () => {
      const res = await compareLanguages(langA, langB)
      setResult(res)
    })
  }

  const handleClose = () => {
    setResult(null)
    setLangA("")
    setLangB("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Compare Languages
          </DialogTitle>
        </DialogHeader>

        {/* Language selector */}
        <div className="flex items-center gap-3">
          <select
            value={langA}
            onChange={(e) => { setLangA(e.target.value); setResult(null) }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select language...</option>
            {languages.map(l => (
              <option key={l.id} value={l.id} disabled={l.id === langB}>{l.name}</option>
            ))}
          </select>

          <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />

          <select
            value={langB}
            onChange={(e) => { setLangB(e.target.value); setResult(null) }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select language...</option>
            {languages.map(l => (
              <option key={l.id} value={l.id} disabled={l.id === langA}>{l.name}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleCompare}
          disabled={!langA || !langB || langA === langB || isPending}
          className="w-full gap-2"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Comparing...</>
          ) : (
            <><GitCompareArrows className="h-4 w-4" /> Compare</>
          )}
        </Button>

        {/* Results */}
        {result && !("error" in result) && (
          <div className="space-y-4 mt-2">
            {/* Overview cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <div className="text-2xl font-bold text-blue-500">{result.overlapPercent}%</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Vocabulary Overlap</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-500">{result.sharedGlosses.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Shared Meanings</div>
              </div>
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-center">
                <div className="text-lg font-bold text-purple-500">
                  {result.totalA} / {result.totalB}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Words (A / B)</div>
              </div>
            </div>

            {/* Unique counts */}
            <div className="flex gap-3 text-xs">
              <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                <span className="font-medium">{result.uniqueToA}</span>
                <span className="text-muted-foreground"> unique to </span>
                <span className="font-medium">{result.languageA.name}</span>
              </div>
              <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                <span className="font-medium">{result.uniqueToB}</span>
                <span className="text-muted-foreground"> unique to </span>
                <span className="font-medium">{result.languageB.name}</span>
              </div>
            </div>

            {/* Cognate candidates table */}
            {result.sharedGlosses.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Potential Cognates (shared meanings)
                </h3>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-3 py-2 text-left font-medium text-xs">Meaning</th>
                        <th className="px-3 py-2 text-left font-medium text-xs">{result.languageA.name}</th>
                        <th className="px-3 py-2 text-left font-medium text-xs">{result.languageB.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.sharedGlosses.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5 text-muted-foreground text-xs">{row.gloss}</td>
                          <td className="px-3 py-1.5">
                            <span className="font-serif font-medium">{row.lemmaA}</span>
                            {row.ipaA && (
                              <span className="text-[10px] text-muted-foreground ml-1.5">/{row.ipaA}/</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="font-serif font-medium">{row.lemmaB}</span>
                            {row.ipaB && (
                              <span className="text-[10px] text-muted-foreground ml-1.5">/{row.ipaB}/</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.sharedGlosses.length >= 100 && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    Showing first 100 of {result.sharedGlosses.length} shared meanings
                  </p>
                )}
              </div>
            )}

            {result.sharedGlosses.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No shared meanings found between these languages.
              </div>
            )}
          </div>
        )}

        {result && "error" in result && (
          <div className="text-center py-4 text-sm text-destructive">
            {result.error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
