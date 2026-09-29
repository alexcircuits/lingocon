"use client"

import { useState, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { suggestIpaFromLemma } from "@/lib/utils/ipa-from-lemma"
import type { ScriptSymbol } from "@prisma/client"

interface BulkAddRow {
  id: string
  lemma: string
  gloss: string
  ipa: string
  partOfSpeech: string
  notes: string
}

function createEmptyRow(): BulkAddRow {
  return {
    id: crypto.randomUUID(),
    lemma: "",
    gloss: "",
    ipa: "",
    partOfSpeech: "",
    notes: "",
  }
}

interface BulkAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { lemma: string; gloss: string; ipa: string; partOfSpeech: string; notes: string }) => Promise<void>
  isPending?: boolean
  symbols?: ScriptSymbol[]
}

export function BulkAddDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  symbols = [],
}: BulkAddDialogProps) {
  const t = useTranslations("studio.dictionary")
  const tc = useTranslations("studio.common")
  const [rows, setRows] = useState<BulkAddRow[]>(() =>
    Array.from({ length: 5 }, createEmptyRow)
  )
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, Set<string>>>({})
  const tableRef = useRef<HTMLDivElement>(null)

  const canSuggestIpa = symbols.some((s) => s.ipa)

  const updateRow = useCallback((id: string, field: keyof BulkAddRow, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, [field]: value }
      if (field === "lemma" && !row.ipa.trim() && canSuggestIpa) {
        updated.ipa = suggestIpaFromLemma(value, symbols)
      }
      return updated
    }))
    // Clear error for this field
    setErrors(prev => {
      const rowErrors = prev[id]
      if (!rowErrors) return prev
      const updated = new Set(rowErrors)
      updated.delete(field)
      if (updated.size === 0) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: updated }
    })
  }, [canSuggestIpa, symbols])

  const fillIpaForEmptyRows = useCallback(() => {
    if (!canSuggestIpa) {
      toast.error(t("toastNeedIpa"))
      return
    }
    setRows(prev =>
      prev.map(row => {
        if (!row.lemma.trim() || row.ipa.trim()) return row
        return { ...row, ipa: suggestIpaFromLemma(row.lemma, symbols) }
      })
    )
    toast.success(t("toastIpaFilled"))
  }, [canSuggestIpa, symbols, t])

  const addRows = useCallback((count: number = 5) => {
    setRows(prev => [...prev, ...Array.from({ length: count }, createEmptyRow)])
    // Scroll to bottom after adding
    requestAnimationFrame(() => {
      if (tableRef.current) {
        tableRef.current.scrollTop = tableRef.current.scrollHeight
      }
    })
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows(prev => {
      if (prev.length <= 1) return prev
      return prev.filter(row => row.id !== id)
    })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: string) => {
    if (e.key === "Tab" && !e.shiftKey) {
      const isLastField = field === "notes"
      const isLastRow = rowIndex === rows.length - 1
      if (isLastField && isLastRow) {
        e.preventDefault()
        addRows(1)
        // Focus first field of new row after render
        requestAnimationFrame(() => {
          const inputs = tableRef.current?.querySelectorAll("input")
          if (inputs) {
            const lastRowInputs = Array.from(inputs).slice(-5)
            lastRowInputs[0]?.focus()
          }
        })
      }
    }
  }, [rows.length, addRows])

  const handleSubmit = async () => {
    // Filter to rows that have at least a lemma
    const filledRows = rows.filter(row => row.lemma.trim())

    if (filledRows.length === 0) {
      toast.error(t("toastNeedOneEntry"))
      return
    }

    // Validate: rows with lemma must also have gloss
    const newErrors: Record<string, Set<string>> = {}
    for (const row of filledRows) {
      const rowErrors = new Set<string>()
      if (!row.lemma.trim()) rowErrors.add("lemma")
      if (!row.gloss.trim()) rowErrors.add("gloss")
      if (rowErrors.size > 0) newErrors[row.id] = rowErrors
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error(t("toastNeedLemmaGloss"))
      return
    }

    setSubmitting(true)
    let successCount = 0
    let failCount = 0

    for (const row of filledRows) {
      try {
        const ipa =
          row.ipa.trim() ||
          (canSuggestIpa ? suggestIpaFromLemma(row.lemma.trim(), symbols) : "")

        await onSubmit({
          lemma: row.lemma.trim(),
          gloss: row.gloss.trim(),
          ipa,
          partOfSpeech: row.partOfSpeech.trim(),
          notes: row.notes.trim(),
        })
        successCount++
      } catch {
        failCount++
      }
    }

    setSubmitting(false)

    if (successCount > 0) {
      toast.success(t("toastAdded", { count: successCount }))
      if (failCount > 0) toast.error(t("toastSomeFailed", { count: failCount }))
      // Reset the form
      setRows(Array.from({ length: 5 }, createEmptyRow))
      setErrors({})
      onOpenChange(false)
    } else {
      toast.error(t("toastFailedAll"))
    }
  }

  const filledCount = rows.filter(r => r.lemma.trim()).length

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!submitting) onOpenChange(v)
    }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("bulkAddEntries")}</DialogTitle>
          <DialogDescription>
            {t("bulkAddDesc")}
            {canSuggestIpa && <>{" "}{t("bulkAddDescIpa")}</>}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={tableRef}
          className="flex-1 overflow-auto scroll-fade-x border rounded-md min-h-0"
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr className="border-b">
                <th className="text-left font-medium px-2 py-2 w-8 text-muted-foreground">#</th>
                <th className="text-left font-medium px-2 py-2 min-w-[140px]">{t("colLemma")}</th>
                <th className="text-left font-medium px-2 py-2 min-w-[160px]">{t("colGloss")}</th>
                <th className="text-left font-medium px-2 py-2 min-w-[100px]">{t("colIpa")}</th>
                <th className="text-left font-medium px-2 py-2 min-w-[100px]">{t("colPos")}</th>
                <th className="text-left font-medium px-2 py-2 min-w-[140px]">{t("colNotes")}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b last:border-b-0 group">
                  <td className="px-2 py-1 text-muted-foreground text-xs tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.lemma}
                      onChange={e => updateRow(row.id, "lemma", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, index, "lemma")}
                      placeholder={t("phLemma")}
                      className={cn(
                        "h-8 text-sm font-custom-script border-0 shadow-none focus-visible:ring-1 rounded-sm bg-transparent",
                        errors[row.id]?.has("lemma") && "ring-1 ring-destructive"
                      )}
                      disabled={submitting}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.gloss}
                      onChange={e => updateRow(row.id, "gloss", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, index, "gloss")}
                      placeholder={t("phGloss")}
                      className={cn(
                        "h-8 text-sm border-0 shadow-none focus-visible:ring-1 rounded-sm bg-transparent",
                        errors[row.id]?.has("gloss") && "ring-1 ring-destructive"
                      )}
                      disabled={submitting}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.ipa}
                      onChange={e => updateRow(row.id, "ipa", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, index, "ipa")}
                      placeholder={t("phIpa")}
                      className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 rounded-sm bg-transparent"
                      disabled={submitting}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.partOfSpeech}
                      onChange={e => updateRow(row.id, "partOfSpeech", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, index, "partOfSpeech")}
                      placeholder={t("phPos")}
                      className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 rounded-sm bg-transparent"
                      disabled={submitting}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.notes}
                      onChange={e => updateRow(row.id, "notes", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, index, "notes")}
                      placeholder={t("phNotes")}
                      className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 rounded-sm bg-transparent"
                      disabled={submitting}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Button aria-label="Delete"
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover-reveal text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row.id)}
                      disabled={submitting || rows.length <= 1}
                      tabIndex={-1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addRows(5)}
            disabled={submitting}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("add5Rows")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addRows(10)}
            disabled={submitting}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("add10Rows")}
          </Button>
          {canSuggestIpa && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillIpaForEmptyRows}
              disabled={submitting}
            >
              {t("fillIpa")}
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {t("rowsReady", { count: filledCount })}
          </span>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || isPending || filledCount === 0}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("adding")}
              </>
            ) : (
              t("addNEntries", { count: filledCount })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
