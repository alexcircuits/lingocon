"use client"

import { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  BookOpen,
  ArrowRight,
  Loader2,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  getProtoVocabulary,
  createProtoWord,
  deleteProtoWord,
  deriveFromProto,
} from "@/app/actions/language-family"
import { useRouter } from "next/navigation"

interface ProtoWord {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  notes: string | null
}

interface TargetLanguage {
  id: string
  name: string
}

interface ProtoVocabularyPanelProps {
  familyId: string
  familyName: string
  isEditable: boolean // true if user owns this family (USER type)
  targetLanguages: TargetLanguage[] // User's languages to derive into
  onClose: () => void
}

export function ProtoVocabularyPanel({
  familyId,
  familyName,
  isEditable,
  targetLanguages,
  onClose,
}: ProtoVocabularyPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [words, setWords] = useState<ProtoWord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedTarget, setSelectedTarget] = useState<string>("")
  const pageSize = 30

  // Add new proto-word form
  const [showAdd, setShowAdd] = useState(false)
  const [newLemma, setNewLemma] = useState("")
  const [newGloss, setNewGloss] = useState("")
  const [newIpa, setNewIpa] = useState("")

  // Fetch proto-words
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(true)
      getProtoVocabulary(familyId, query, page, pageSize).then((res) => {
        setWords(res.words)
        setTotal(res.total)
        setIsLoading(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [familyId, query, page])

  const toggleWord = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddWord = () => {
    if (!newLemma.trim() || !newGloss.trim()) return
    startTransition(async () => {
      const result = await createProtoWord(familyId, {
        lemma: newLemma,
        gloss: newGloss,
        ipa: newIpa || undefined,
      })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success("Proto-word added!")
        setNewLemma("")
        setNewGloss("")
        setNewIpa("")
        setShowAdd(false)
        // Refresh list
        setIsLoading(true)
        getProtoVocabulary(familyId, query, page, pageSize).then((res) => {
          setWords(res.words)
          setTotal(res.total)
          setIsLoading(false)
        })
      }
    })
  }

  const handleDeleteWord = (wordId: string) => {
    startTransition(async () => {
      const result = await deleteProtoWord(wordId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success("Proto-word removed")
        setWords((w) => w.filter((pw) => pw.id !== wordId))
        setTotal((t) => t - 1)
        selectedIds.delete(wordId)
        setSelectedIds(new Set(selectedIds))
      }
    })
  }

  const handleDerive = () => {
    if (selectedIds.size === 0 || !selectedTarget) return
    startTransition(async () => {
      const result = await deriveFromProto(
        Array.from(selectedIds),
        selectedTarget
      )
      if ('error' in result) {
        toast.error(result.error)
      } else {
        const targetName =
          targetLanguages.find((l) => l.id === selectedTarget)?.name ||
          "language"
        toast.success(
          `Derived ${result.count} word${result.count !== 1 ? "s" : ""} into ${targetName}!`
        )
        setSelectedIds(new Set())
        router.refresh()
      }
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-medium text-sm">Proto-Vocabulary</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{familyName}</p>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search proto-words..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Add new proto-word form (only for editable families) */}
      {isEditable && (
        <div className="px-4 py-2 border-b border-border/30">
          {showAdd ? (
            <div className="space-y-2">
              <Input
                placeholder="*lemma (e.g. *wódr̥)"
                value={newLemma}
                onChange={(e) => setNewLemma(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
              />
              <Input
                placeholder="Meaning (e.g. water)"
                value={newGloss}
                onChange={(e) => setNewGloss(e.target.value)}
                className="h-7 text-xs"
              />
              <Input
                placeholder="IPA (optional)"
                value={newIpa}
                onChange={(e) => setNewIpa(e.target.value)}
                className="h-7 text-xs font-mono"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  onClick={handleAddWord}
                  disabled={isPending || !newLemma.trim() || !newGloss.trim()}
                  className="h-7 text-xs flex-1"
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdd(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(true)}
              className="w-full gap-1.5 h-7 text-xs"
            >
              <Plus className="h-3 w-3" />
              Add Proto-Word
            </Button>
          )}
        </div>
      )}

      {/* Word List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : words.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No proto-words in this family yet.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 mb-1">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : `${total} proto-word${total !== 1 ? "s" : ""}`}
                </span>
              </div>

              {words.map((word) => (
                <button
                  key={word.id}
                  onClick={() => toggleWord(word.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 transition-colors text-left group ${selectedIds.has(word.id) ? "bg-primary/10" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium font-serif truncate">
                        {word.lemma}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {word.gloss}
                    </div>
                  </div>
                  {word.ipa && (
                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                      /{word.ipa}/
                    </span>
                  )}
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteWord(word.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
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
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-6 w-6"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-6 w-6"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Derive action footer */}
      <div className="p-3 border-t border-border/50 space-y-2">
        {targetLanguages.length > 0 && (
          <>
            <Label className="text-xs text-muted-foreground">
              Derive into:
            </Label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="">Select a language...</option>
              {targetLanguages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </>
        )}
        <Button
          onClick={handleDerive}
          disabled={
            isPending || selectedIds.size === 0 || !selectedTarget
          }
          className="w-full gap-2 text-sm"
          size="sm"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Derive{" "}
          {selectedIds.size > 0
            ? `${selectedIds.size} word${selectedIds.size !== 1 ? "s" : ""}`
            : "words"}
        </Button>
      </div>
    </div>
  )
}
