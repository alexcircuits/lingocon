"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Eye, Play } from "lucide-react"
import { previewModuleTransform, applyModuleTransform } from "@/app/actions/module"

interface PreviewRow {
  id: string
  before: string
  after: string
}

export function DeclarativeTransformerPanel({
  languageId,
  moduleId,
  rulesPreview,
}: {
  languageId: string
  moduleId: string
  rulesPreview: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<PreviewRow[] | null>(null)
  const [stats, setStats] = useState<{ changedCount: number; total: number } | null>(null)

  function preview() {
    startTransition(async () => {
      const res = await previewModuleTransform(languageId, moduleId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setRows(res.data.changed)
      setStats({ changedCount: res.data.changedCount, total: res.data.total })
    })
  }

  function apply() {
    startTransition(async () => {
      const res = await applyModuleTransform(languageId, moduleId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Applied to ${res.data.applied} entries (${res.data.unchanged} unchanged)`)
      setRows(null)
      setStats(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rule pack</CardTitle>
          <CardDescription>
            These rules transform your dictionary lemmas when applied. Preview first to see what
            changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-4 font-mono text-xs">
            {rulesPreview || "No rules"}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={preview} disabled={pending}>
              <Eye className="mr-2 h-4 w-4" />
              Preview changes
            </Button>
            <Button onClick={apply} disabled={pending}>
              <Play className="mr-2 h-4 w-4" />
              Apply to dictionary
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {stats.changedCount} of {stats.total} entries would change
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows && rows.length > 0 ? (
              <ul className="space-y-1.5 font-mono text-sm">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="text-muted-foreground line-through">{r.before}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-primary">{r.after}</span>
                  </li>
                ))}
                {stats.changedCount > rows.length && (
                  <li className="pt-1 font-sans text-xs text-muted-foreground">
                    …and {stats.changedCount - rows.length} more
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No entries would change.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
