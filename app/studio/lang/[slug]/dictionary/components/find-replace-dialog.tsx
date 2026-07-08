"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { previewBulkFindReplace, applyBulkFindReplace } from "@/app/actions/bulk-lexicon"
import type { LexField } from "@/lib/bulk-lexicon"
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

interface Change {
  id: string
  before: string
  after: string
}

interface Props {
  languageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

const FIELDS: { value: LexField; label: string }[] = [
  { value: "lemma", label: "Lemma" },
  { value: "gloss", label: "Gloss" },
  { value: "ipa", label: "IPA" },
]

export function FindReplaceDialog({ languageId, open, onOpenChange, onApplied }: Props) {
  const [field, setField] = useState<LexField>("lemma")
  const [pattern, setPattern] = useState("")
  const [replacement, setReplacement] = useState("")
  const [caseInsensitive, setCaseInsensitive] = useState(false)
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [total, setTotal] = useState(0)
  const [isPending, start] = useTransition()

  const reset = () => {
    setChanges(null)
    setTotal(0)
  }

  function handlePreview() {
    start(async () => {
      const res = await previewBulkFindReplace({ languageId, field, pattern, replacement, caseInsensitive })
      if ("error" in res) {
        toast.error(res.error)
        reset()
        return
      }
      setChanges(res.data.changes)
      setTotal(res.data.total)
      if (res.data.total === 0) toast.info("No entries match that pattern.")
    })
  }

  function handleApply() {
    start(async () => {
      const res = await applyBulkFindReplace({ languageId, field, pattern, replacement, caseInsensitive })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Updated ${res.data.updatedCount} ${res.data.updatedCount === 1 ? "entry" : "entries"}.`)
      reset()
      onOpenChange(false)
      onApplied?.()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find &amp; replace</DialogTitle>
          <DialogDescription>
            Regular-expression find/replace across a dictionary field. Supports <code>$1</code>{" "}
            backreferences. Always preview before applying — this rewrites matching entries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label>Field</Label>
              <div className="flex gap-1 mt-1">
                {FIELDS.map((f) => (
                  <Button
                    key={f.value}
                    type="button"
                    size="sm"
                    variant={field === f.value ? "default" : "outline"}
                    onClick={() => {
                      setField(f.value)
                      reset()
                    }}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-1">
              <input
                type="checkbox"
                checked={caseInsensitive}
                onChange={(e) => {
                  setCaseInsensitive(e.target.checked)
                  reset()
                }}
              />
              Case-insensitive
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fr-pattern">Find (regex)</Label>
              <Input
                id="fr-pattern"
                className="font-mono"
                placeholder="e.g. ^ka"
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value)
                  reset()
                }}
              />
            </div>
            <div>
              <Label htmlFor="fr-replacement">Replace with</Label>
              <Input
                id="fr-replacement"
                className="font-mono"
                placeholder="e.g. ga"
                value={replacement}
                onChange={(e) => {
                  setReplacement(e.target.value)
                  reset()
                }}
              />
            </div>
          </div>

          {changes !== null && (
            <div className="rounded-md border">
              <div className="px-3 py-2 text-sm font-medium border-b bg-muted/40">
                {total === 0
                  ? "No matches"
                  : `${total} ${total === 1 ? "entry" : "entries"} will change` +
                    (changes.length < total ? ` (showing first ${changes.length})` : "")}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y">
                {changes.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground line-through">{c.before}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{c.after}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePreview} disabled={isPending || !pattern}>
            Preview
          </Button>
          <Button onClick={handleApply} disabled={isPending || changes === null || total === 0}>
            {isPending ? "Working…" : `Apply${total ? ` to ${total}` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
