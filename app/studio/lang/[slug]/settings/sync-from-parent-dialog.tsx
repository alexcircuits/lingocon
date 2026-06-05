"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { toast } from "sonner"
import { Download, Loader2, Search, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getLanguageDictionary, deriveWords, getImportedSourceIds } from "@/app/actions/language-family"

interface Entry {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  partOfSpeech: string | null
}

interface SyncFromParentDialogProps {
  sourceLanguageId: string
  sourceLanguageName: string
  targetLanguageId: string
}

const PAGE_SIZE = 50

export function SyncFromParentDialog({
  sourceLanguageId,
  sourceLanguageName,
  targetLanguageId,
}: SyncFromParentDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Load imported IDs once when dialog opens
  useEffect(() => {
    if (!open) return
    getImportedSourceIds(targetLanguageId).then((ids) =>
      setImportedIds(new Set(ids))
    )
  }, [open, targetLanguageId])

  // Load entries from parent dictionary
  const loadEntries = useCallback(
    async (q: string, p: number) => {
      setLoading(true)
      try {
        const result = await getLanguageDictionary(sourceLanguageId, q, p, PAGE_SIZE)
        setEntries(result.entries as Entry[])
        setTotal(result.total)
      } finally {
        setLoading(false)
      }
    },
    [sourceLanguageId]
  )

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setPage(1)
      loadEntries(query, 1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open, loadEntries])

  useEffect(() => {
    if (!open || page === 1) return
    loadEntries(query, page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const importable = entries.filter((e) => !importedIds.has(e.id)).map((e) => e.id)
    const allSelected = importable.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        importable.forEach((id) => next.delete(id))
      } else {
        importable.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleImport = () => {
    if (selected.size === 0) return
    startTransition(async () => {
      const result = await deriveWords(sourceLanguageId, targetLanguageId, Array.from(selected))
      if ("error" in result) {
        toast.error(result.error)
      } else {
        const count = result.data.count
        toast.success(
          count > 0
            ? `Imported ${count} word${count !== 1 ? "s" : ""} from ${sourceLanguageName}`
            : "All selected words were already imported"
        )
        // Mark them as imported locally so UI reflects it immediately
        setImportedIds((prev) => {
          const next = new Set(prev)
          selected.forEach((id) => next.add(id))
          return next
        })
        setSelected(new Set())
      }
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const importableOnPage = entries.filter((e) => !importedIds.has(e.id))
  const allOnPageSelected =
    importableOnPage.length > 0 && importableOnPage.every((e) => selected.has(e.id))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-3.5 w-3.5" />
          Sync from {sourceLanguageName}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sync words from {sourceLanguageName}</DialogTitle>
          <DialogDescription>
            Select words to copy into this language. Already-imported words are shown
            as imported and can&apos;t be selected again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Search by word or gloss…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center justify-between py-2 text-sm">
          <span className="text-muted-foreground">
            {total} word{total !== 1 ? "s" : ""} · {selected.size} selected
          </span>
          {importableOnPage.length > 0 && (
            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
              {allOnPageSelected ? "Deselect page" : "Select page"}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No words found.</p>
          ) : (
            <div className="space-y-1 pr-2">
              {entries.map((entry) => {
                const isImported = importedIds.has(entry.id)
                const isSelected = selected.has(entry.id)
                return (
                  <button
                    key={entry.id}
                    disabled={isImported}
                    onClick={() => !isImported && toggleSelect(entry.id)}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                      isImported
                        ? "cursor-default opacity-50"
                        : isSelected
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border">
                        {(isSelected || isImported) && (
                          <Check className={`h-3 w-3 ${isImported ? "text-muted-foreground" : "text-primary"}`} />
                        )}
                      </div>
                      <span className="font-serif font-medium">{entry.lemma}</span>
                      {entry.ipa && (
                        <span className="font-ipa text-xs text-muted-foreground">/{entry.ipa}/</span>
                      )}
                      {entry.partOfSpeech && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {entry.partOfSpeech}
                        </Badge>
                      )}
                      {isImported && (
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                          imported
                        </Badge>
                      )}
                    </div>
                    {entry.gloss && (
                      <p className="ml-6 mt-0.5 text-xs text-muted-foreground">{entry.gloss}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Previous
            </Button>
            <span className="text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={selected.size === 0 || isPending}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Import {selected.size > 0 ? `${selected.size} word${selected.size !== 1 ? "s" : ""}` : "selected"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
