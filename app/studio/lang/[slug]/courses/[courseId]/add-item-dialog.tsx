"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus, Loader2, BookOpen, FileText, MessageSquare, Type, Check,
  ExternalLink, Search, X, ChevronsDown,
} from "lucide-react"
import {
  addLessonItem, createAndAddSentence, createAndAddVocab,
  searchDictEntries, searchCourseSentences,
} from "@/app/actions/learn"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type {
  DictEntry, GrammarPage, TextItem, SentenceOption, LessonItem, ItemType,
} from "./types"

export function AddItemDialog({
  lessonId, languageId, slug, grammarPages, texts, onAdded,
}: {
  lessonId: string
  languageId: string
  slug: string
  grammarPages: GrammarPage[]
  texts: TextItem[]
  onAdded: (item: LessonItem) => void
}) {
  const t = useTranslations("courseEditor")
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ItemType>("VOCAB")
  const [mode, setMode] = useState<"search" | "write">("search")
  const [loading, setLoading] = useState(false)

  // Server-fetched search results
  const [searchQuery, setSearchQuery] = useState("")
  const [vocabResults, setVocabResults] = useState<DictEntry[]>([])
  const [sentenceResults, setSentenceResults] = useState<SentenceOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 50
  const [selectedItem, setSelectedItem] = useState<{ id: string; data: DictEntry | SentenceOption | GrammarPage | TextItem } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Word picker for write-sentence mode (inline, async)
  const [wordPickerQuery, setWordPickerQuery] = useState("")
  const [wordPickerResults, setWordPickerResults] = useState<DictEntry[]>([])
  const [wordPickerOpen, setWordPickerOpen] = useState(false)
  const [sentDictEntry, setSentDictEntry] = useState<DictEntry | null>(null)

  // Write mode — sentence
  const [sentText, setSentText] = useState("")
  const [sentTranslation, setSentTranslation] = useState("")
  const [sentGloss, setSentGloss] = useState("")

  // Write mode — vocab
  const [vocabLemma, setVocabLemma] = useState("")
  const [vocabGloss, setVocabGloss] = useState("")
  const [vocabPos, setVocabPos] = useState("")

  // Load initial results when dialog opens or type changes
  const loadInitial = useCallback(async (t: ItemType, q = "") => {
    if (t === "VOCAB") {
      setIsSearching(true)
      const r = await searchDictEntries(languageId, q, 0)
      setVocabResults(r)
      setOffset(r.length)
      setHasMore(r.length === PAGE_SIZE)
      setIsSearching(false)
    } else if (t === "SENTENCE") {
      setIsSearching(true)
      const r = await searchCourseSentences(languageId, q, 0)
      setSentenceResults(r)
      setOffset(r.length)
      setHasMore(r.length === PAGE_SIZE)
      setIsSearching(false)
    }
  }, [languageId])

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    if (type === "VOCAB") {
      const r = await searchDictEntries(languageId, searchQuery, offset)
      setVocabResults(prev => [...prev, ...r])
      setOffset(prev => prev + r.length)
      setHasMore(r.length === PAGE_SIZE)
    } else if (type === "SENTENCE") {
      const r = await searchCourseSentences(languageId, searchQuery, offset)
      setSentenceResults(prev => [...prev, ...r])
      setOffset(prev => prev + r.length)
      setHasMore(r.length === PAGE_SIZE)
    }
    setIsLoadingMore(false)
  }, [isLoadingMore, type, languageId, searchQuery, offset])

  useEffect(() => {
    if (!open) return
    loadInitial(type)
    // Focus search input
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — resets pagination each time query changes
  useEffect(() => {
    if (!open || mode !== "search") return
    if (type !== "VOCAB" && type !== "SENTENCE") return

    const timer = setTimeout(() => loadInitial(type, searchQuery), 280)
    return () => clearTimeout(timer)
  }, [searchQuery, type, open, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Word picker search for write-sentence mode
  useEffect(() => {
    if (!wordPickerOpen) return
    const timer = setTimeout(async () => {
      const r = await searchDictEntries(languageId, wordPickerQuery)
      setWordPickerResults(r)
    }, 280)
    return () => clearTimeout(timer)
  }, [wordPickerQuery, wordPickerOpen, languageId])

  function handleTypeChange(newType: ItemType) {
    setType(newType)
    setMode("search")
    setSelectedItem(null)
    setSearchQuery("")
    setOffset(0)
    setHasMore(false)
    loadInitial(newType, "")
  }

  function resetAll() {
    setType("VOCAB")
    setMode("search")
    setSelectedItem(null)
    setSearchQuery("")
    setVocabResults([])
    setSentenceResults([])
    setOffset(0)
    setHasMore(false)
    setSentText("")
    setSentTranslation("")
    setSentGloss("")
    setSentDictEntry(null)
    setWordPickerQuery("")
    setWordPickerOpen(false)
    setVocabLemma("")
    setVocabGloss("")
    setVocabPos("")
  }

  // Static search for grammar/text (already loaded)
  const staticOptions: Array<{ id: string; label: string; sub?: string }> =
    type === "GRAMMAR"
      ? grammarPages
          .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(p => ({ id: p.id, label: p.title }))
      : type === "TEXT"
      ? texts
          .filter(t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(t => ({ id: t.id, label: t.title }))
      : []

  const dynamicOptions: Array<{ id: string; label: string; sub?: string }> =
    type === "VOCAB"
      ? vocabResults.map(e => ({ id: e.id, label: e.lemma, sub: `${e.gloss}${e.partOfSpeech ? ` · ${e.partOfSpeech}` : ""}` }))
      : type === "SENTENCE"
      ? sentenceResults.map(s => ({ id: s.id, label: s.sentence, sub: s.translation }))
      : []

  const listOptions = type === "GRAMMAR" || type === "TEXT" ? staticOptions : dynamicOptions

  async function handleAddExisting() {
    if (!selectedItem) return
    setLoading(true)
    try {
      const r = await addLessonItem(lessonId, type, selectedItem.id)
      if (r.data) {
        const d = selectedItem.data
        onAdded({
          id: r.data.id, type, order: r.data.order,
          dictEntry:   type === "VOCAB"    ? (d as DictEntry) : null,
          grammarPage: type === "GRAMMAR"  ? (d as GrammarPage) : null,
          text:        type === "TEXT"     ? (d as TextItem) : null,
          sentence:    type === "SENTENCE" ? (d as SentenceOption) : null,
        })
        resetAll()
        setOpen(false)
        toast.success(t("itemAdded"))
      } else if (r.error) {
        toast.error(r.error)
      }
    } catch {
      toast.error(t("failAddItem"))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSentence() {
    if (!sentText.trim() || !sentTranslation.trim() || !sentDictEntry) return
    setLoading(true)
    try {
      const r = await createAndAddSentence(lessonId, sentDictEntry.id, sentText.trim(), sentTranslation.trim(), sentGloss.trim() || undefined)
      if (r.data) {
        onAdded({
          id: r.data.item.id, type: "SENTENCE", order: r.data.item.order,
          dictEntry: null, grammarPage: null, text: null,
          sentence: r.data.sentence,
        })
        resetAll()
        setOpen(false)
        toast.success(t("sentenceCreated"))
      } else if (r.error) {
        toast.error(r.error)
      }
    } catch {
      toast.error(t("failCreateSentence"))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateVocab() {
    if (!vocabLemma.trim() || !vocabGloss.trim()) return
    setLoading(true)
    try {
      const r = await createAndAddVocab(lessonId, languageId, vocabLemma.trim(), vocabGloss.trim(), vocabPos.trim() || undefined)
      if (r.data) {
        onAdded({
          id: r.data.item.id, type: "VOCAB", order: r.data.item.order,
          dictEntry: r.data.dictEntry, grammarPage: null, text: null, sentence: null,
        })
        resetAll()
        setOpen(false)
        toast.success(t("wordCreated"))
      } else if (r.error) {
        toast.error(r.error)
      }
    } catch {
      toast.error(t("failCreateWord"))
    } finally {
      setLoading(false)
    }
  }

  const canWrite = type === "VOCAB" || type === "SENTENCE"

  const submitDisabled = loading || (
    mode === "search"
      ? !selectedItem
      : type === "SENTENCE"
        ? (!sentText.trim() || !sentTranslation.trim() || !sentDictEntry)
        : (!vocabLemma.trim() || !vocabGloss.trim())
  )

  function handleSubmit() {
    if (mode === "search") return handleAddExisting()
    if (type === "SENTENCE") return handleCreateSentence()
    if (type === "VOCAB") return handleCreateVocab()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAll(); setOpen(o) }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          {t("addItem")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t("addItemToLesson")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0 flex-1">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-1.5 shrink-0">
            {([
              ["VOCAB",    t("typeVocab"),    <Type key="v" className="h-3.5 w-3.5" />],
              ["GRAMMAR",  t("typeGrammar"),  <BookOpen key="g" className="h-3.5 w-3.5" />],
              ["TEXT",     t("typeText"),     <FileText key="t" className="h-3.5 w-3.5" />],
              ["SENTENCE", t("typeSentence"), <MessageSquare key="s" className="h-3.5 w-3.5" />],
            ] as [ItemType, string, React.ReactNode][]).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleTypeChange(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border-2 py-2.5 px-1 text-xs font-medium transition-all",
                  type === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/30 text-muted-foreground"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Find / Write toggle */}
          {canWrite && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium shrink-0">
              <button type="button" onClick={() => { setMode("search"); setSelectedItem(null) }}
                className={cn("flex-1 px-3 py-1.5 transition-colors",
                  mode === "search" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                )}>
                {t("findExisting")}
              </button>
              <button type="button" onClick={() => setMode("write")}
                className={cn("flex-1 px-3 py-1.5 transition-colors border-l border-border",
                  mode === "write" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                )}>
                {t("writeNew")}
              </button>
            </div>
          )}

          {/* Content area */}
          {mode === "search" ? (
            <div className="flex flex-col gap-2 min-h-0 flex-1">
              {/* Search input */}
              {(type === "VOCAB" || type === "SENTENCE" || staticOptions.length > 3 || type === "GRAMMAR" || type === "TEXT") && (
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedItem(null) }}
                    placeholder={type === "VOCAB" ? t("searchVocabPh") : type === "GRAMMAR" ? t("searchGrammarPh") : type === "TEXT" ? t("searchTextsPh") : t("searchSentencesPh")}
                    className="pl-8 pr-8"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSelectedItem(null) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Results list */}
              <div className="h-[260px] overflow-y-auto rounded-md border border-border">
                <div className="p-1">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : listOptions.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {searchQuery
                        ? t("noMatching", { query: searchQuery })
                        : t("noContentYet")}
                      {canWrite && !searchQuery && (
                        <button onClick={() => setMode("write")} className="mt-1 block w-full text-xs text-primary hover:underline">
                          {t("writeNewInstead")}
                        </button>
                      )}
                      {(type === "GRAMMAR" || type === "TEXT") && (
                        <a
                          href={type === "GRAMMAR" ? `/studio/lang/${slug}/grammar` : `/studio/lang/${slug}/texts`}
                          target="_blank" rel="noopener noreferrer"
                          className="mt-1 flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("openEditor")}
                        </a>
                      )}
                    </div>
                  ) : (
                    <>
                      {listOptions.map((opt) => {
                        const isSelected = selectedItem?.id === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              const raw =
                                type === "VOCAB"    ? vocabResults.find(e => e.id === opt.id)
                                : type === "SENTENCE" ? sentenceResults.find(s => s.id === opt.id)
                                : type === "GRAMMAR"  ? grammarPages.find(p => p.id === opt.id)
                                : texts.find(t => t.id === opt.id)
                              if (raw) setSelectedItem({ id: opt.id, data: raw })
                            }}
                            className={cn(
                              "w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-start gap-2",
                              isSelected
                                ? "bg-primary/10 ring-1 ring-primary/30"
                                : "hover:bg-secondary/60"
                            )}
                          >
                            <div className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center",
                              isSelected ? "border-primary bg-primary" : "border-border")}>
                              {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={cn("block truncate font-medium", (type === "VOCAB" || type === "SENTENCE") ? "font-custom-script" : "")}>{opt.label}</span>
                              {opt.sub && <span className="block truncate text-xs text-muted-foreground">{opt.sub}</span>}
                            </div>
                          </button>
                        )
                      })}
                      {(hasMore || isLoadingMore) && (
                        <button
                          type="button"
                          onClick={loadMore}
                          disabled={isLoadingMore}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {isLoadingMore
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ChevronsDown className="h-3.5 w-3.5" />
                          }
                          {isLoadingMore ? t("loadingMore") : t("loadMore")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* External link hint for grammar/text */}
              {(type === "GRAMMAR" || type === "TEXT") && listOptions.length > 0 && (
                <p className="text-xs text-muted-foreground shrink-0">
                  {type === "GRAMMAR" ? t("needNewGrammar") : t("needNewText")}{" "}
                  <a href={type === "GRAMMAR" ? `/studio/lang/${slug}/grammar` : `/studio/lang/${slug}/texts`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline">
                    {t("openEditor")} <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </div>
          ) : (
            /* Write mode */
            <div className="space-y-3 overflow-y-auto flex-1">
              {type === "SENTENCE" && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("sentence")} <span className="text-muted-foreground text-xs font-normal">{t("inConlang")}</span></Label>
                    <Input value={sentText} onChange={e => setSentText(e.target.value)} placeholder={t("sentencePh")} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("translation")}</Label>
                    <Input value={sentTranslation} onChange={e => setSentTranslation(e.target.value)} placeholder={t("translationPh")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("gloss")} <span className="text-muted-foreground text-xs font-normal">{t("optional")}</span></Label>
                    <Input value={sentGloss} onChange={e => setSentGloss(e.target.value)} placeholder={t("glossPh")} />
                  </div>
                  {/* Inline word picker */}
                  <div className="space-y-1.5">
                    <Label>{t("linkToWord")} <span className="text-muted-foreground text-xs font-normal">{t("required")}</span></Label>
                    {sentDictEntry ? (
                      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 bg-secondary/30">
                        <span className="flex-1 text-sm font-custom-script font-medium">{sentDictEntry.lemma}</span>
                        <span className="text-xs text-muted-foreground">{sentDictEntry.gloss}</span>
                        <button onClick={() => setSentDictEntry(null)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={wordPickerQuery}
                            onChange={e => { setWordPickerQuery(e.target.value); setWordPickerOpen(true) }}
                            onFocus={() => { setWordPickerOpen(true); if (!wordPickerResults.length) searchDictEntries(languageId, "").then(setWordPickerResults) }}
                            placeholder={t("searchWordsPh")}
                            className="pl-8"
                          />
                        </div>
                        {wordPickerOpen && (
                          <div className="rounded-md border border-border bg-popover max-h-40 overflow-y-auto shadow-md">
                            {wordPickerResults.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-muted-foreground">{t("noWordsFound")}</p>
                            ) : wordPickerResults.map(e => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => { setSentDictEntry(e); setWordPickerOpen(false); setWordPickerQuery("") }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/60 flex items-center gap-2"
                              >
                                <span className="font-custom-script font-medium">{e.lemma}</span>
                                <span className="text-muted-foreground text-xs">{e.gloss}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {type === "VOCAB" && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("word")} <span className="text-muted-foreground text-xs font-normal">{t("baseForm")}</span></Label>
                    <Input value={vocabLemma} onChange={e => setVocabLemma(e.target.value)} placeholder={t("wordPh")} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("meaning")}</Label>
                    <Input value={vocabGloss} onChange={e => setVocabGloss(e.target.value)} placeholder={t("meaningPh")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("partOfSpeech")} <span className="text-muted-foreground text-xs font-normal">{t("optional")}</span></Label>
                    <Input value={vocabPos} onChange={e => setVocabPos(e.target.value)} placeholder={t("posPh")} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={() => { resetAll(); setOpen(false) }}>{t("cancel")}</Button>
          <Button onClick={handleSubmit} disabled={submitDisabled} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "write" ? t("createAndAdd") : selectedItem ? t("add") : t("selectItem")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
