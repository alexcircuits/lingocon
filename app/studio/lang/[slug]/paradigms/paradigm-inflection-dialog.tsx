"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { applyInflection } from "@/lib/inflection"
import { parseParadigmSlots } from "@/lib/validations/paradigm"
import { getParadigmRules, upsertParadigmRule, deleteParadigmRule, regenerateParadigm } from "@/app/actions/inflection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CellRuleState {
  prefix: string
  suffix: string
  soundChange: string
}

interface ParadigmLike {
  id: string
  name: string
  slots: unknown
}

interface Props {
  paradigm: ParadigmLike | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const emptyRule = (): CellRuleState => ({ prefix: "", suffix: "", soundChange: "" })
const hasRule = (r: CellRuleState) => !!(r.prefix || r.suffix || r.soundChange)

export function ParadigmInflectionDialog({ paradigm, open, onOpenChange }: Props) {
  const slots = useMemo(() => parseParadigmSlots(paradigm?.slots), [paradigm?.slots])
  const [rules, setRules] = useState<Record<string, CellRuleState>>({})
  const [stem, setStem] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSaving, startSave] = useTransition()

  // The cells that actually exist in the grid, with human labels.
  const cells = useMemo(() => {
    const out: { key: string; label: string }[] = []
    slots.rows.forEach((row, r) => {
      slots.columns.forEach((col, c) => {
        out.push({ key: `${r}-${c}`, label: `${row || `Row ${r + 1}`} · ${col || `Col ${c + 1}`}` })
      })
    })
    return out
  }, [slots])

  // Load persisted rules whenever a paradigm is opened.
  useEffect(() => {
    if (!open || !paradigm) return
    setLoading(true)
    getParadigmRules(paradigm.id)
      .then((res) => {
        const next: Record<string, CellRuleState> = {}
        if ("data" in res && res.data) {
          for (const r of res.data) {
            next[r.cellKey] = { prefix: r.prefix, suffix: r.suffix, soundChange: r.soundChange }
          }
        }
        setRules(next)
      })
      .finally(() => setLoading(false))
  }, [open, paradigm])

  const ruleFor = (key: string) => rules[key] ?? emptyRule()
  const setCell = (key: string, patch: Partial<CellRuleState>) =>
    setRules((prev) => ({ ...prev, [key]: { ...ruleFor(key), ...patch } }))

  function handleSave() {
    if (!paradigm) return
    startSave(async () => {
      const outcomes = await Promise.allSettled(
        cells.map((cell) => {
          const r = ruleFor(cell.key)
          return hasRule(r)
            ? upsertParadigmRule({ paradigmId: paradigm.id, cellKey: cell.key, ...r })
            : deleteParadigmRule(paradigm.id, cell.key)
        }),
      )
      const failed = outcomes.filter(
        (o) => o.status === "rejected" || (o.status === "fulfilled" && o.value && "error" in o.value),
      ).length

      if (failed > 0) {
        toast.error(`${failed} of ${cells.length} cells failed to save.`)
        return
      }
      // Regenerate the whole paradigm's forms ONCE, not per cell.
      await regenerateParadigm(paradigm.id)
      toast.success("Inflection rules saved — forms are regenerating in the background.")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auto-inflection — {paradigm?.name}</DialogTitle>
          <DialogDescription>
            Give each cell a transform: a prefix and/or suffix (a leading/trailing{" "}
            <code>-</code> is treated as a morpheme boundary), plus an optional sound-change
            snippet applied after affixing (e.g. <code>a → e / _nn</code>). Any dictionary entry
            using this paradigm is then conjugated automatically.
          </DialogDescription>
        </DialogHeader>

        {cells.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            This paradigm has no cells yet. Add rows and columns in “Edit structure” first.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="stem">Preview stem</Label>
                <Input
                  id="stem"
                  placeholder="type a stem to preview, e.g. kat"
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Cell</th>
                    <th className="py-1 px-1 font-medium">Prefix</th>
                    <th className="py-1 px-1 font-medium">Suffix</th>
                    <th className="py-1 px-1 font-medium">Sound change</th>
                    <th className="py-1 pl-2 font-medium">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => {
                    const r = ruleFor(cell.key)
                    const preview = stem.trim() && hasRule(r) ? applyInflection(stem.trim(), r) : ""
                    return (
                      <tr key={cell.key} className="border-t">
                        <td className="py-1 pr-2 align-middle whitespace-nowrap">{cell.label}</td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-8"
                            value={r.prefix}
                            onChange={(e) => setCell(cell.key, { prefix: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-8"
                            value={r.suffix}
                            onChange={(e) => setCell(cell.key, { suffix: e.target.value })}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <Input
                            className="h-8 font-mono text-xs"
                            placeholder="optional"
                            value={r.soundChange}
                            onChange={(e) => setCell(cell.key, { soundChange: e.target.value })}
                          />
                        </td>
                        <td className="py-1 pl-2 font-medium whitespace-nowrap">
                          {preview || <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || loading || cells.length === 0}>
            {isSaving ? "Saving…" : "Save rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
