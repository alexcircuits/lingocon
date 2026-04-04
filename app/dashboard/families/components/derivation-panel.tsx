"use client"

import { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, BookOpen, ArrowRight, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { getLanguageDictionary, deriveWords } from "@/app/actions/language-family"
import { useRouter } from "next/navigation"

interface DictionaryEntry {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  partOfSpeech: string | null
  tags: any
}

interface DerivationPanelProps {
  sourceLanguageId: string
  sourceLanguageName: string
  targetLanguageId: string
  targetLanguageName: string
  onClose: () => void
}

export function DerivationPanel({
  sourceLanguageId,
  sourceLanguageName,
  targetLanguageId,
  targetLanguageName,
  onClose,
}: DerivationPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const pageSize = 30

  // Fetch entries
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(true)
      getLanguageDictionary(sourceLanguageId, query, page, pageSize).then(res => {
        setEntries(res.entries)
        setTotal(res.total)
        setIsLoading(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [sourceLanguageId, query, page])

  const toggleEntry = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)))
    }
  }

  const handleDerive = () => {
    if (selectedIds.size === 0) return
    startTransition(async () => {
      const result = await deriveWords(sourceLanguageId, targetLanguageId, Array.from(selectedIds))
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Derived ${result.count} word${result.count !== 1 ? "s" : ""} into ${targetLanguageName}!`)
        setSelectedIds(new Set())
        router.refresh()
        onClose()
      }
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-medium text-sm">Derive Words</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{sourceLanguageName}</span>
          <ArrowRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{targetLanguageName}</span>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search words..."
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Entry List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No dictionary entries found.
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 mb-1">
                <Checkbox
                  checked={selectedIds.size === entries.length && entries.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : `${total} word${total !== 1 ? "s" : ""}`}
                </span>
              </div>

              {entries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => toggleEntry(entry.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 transition-colors text-left"
                >
                  <Checkbox checked={selectedIds.has(entry.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{entry.lemma}</span>
                      {entry.partOfSpeech && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {entry.partOfSpeech}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{entry.gloss}</div>
                  </div>
                  {entry.ipa && (
                    <span className="text-xs text-muted-foreground shrink-0">/{entry.ipa}/</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-6 w-6"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-6 w-6"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Action footer */}
      <div className="p-3 border-t border-border/50">
        <Button
          onClick={handleDerive}
          disabled={isPending || selectedIds.size === 0}
          className="w-full gap-2 text-sm"
          size="sm"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Derive {selectedIds.size > 0 ? `${selectedIds.size} word${selectedIds.size !== 1 ? "s" : ""}` : "words"}
        </Button>
      </div>
    </div>
  )
}
