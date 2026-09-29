"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Search, BookOpen, Link2, StickyNote, ArrowLeftRight, Tag, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransliterationToggle } from "@/components/transliteration-toggle"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import { IPASpeaker } from "@/components/ipa-speaker"
import { ExampleSentences } from "@/components/dictionary/example-sentences"
import { EtymologyTree } from "@/components/dictionary/etymology-tree"
import { DictionaryPagination } from "@/components/dictionary/dictionary-pagination"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { getPublicDictionaryEntry } from "@/app/actions/dictionary-entry"
import type { DictionaryEntry, ScriptSymbol, ExampleSentence } from "@prisma/client"

/** One row of the paginated list — long fields stay on the server until an entry is opened. */
export interface PublicDictionaryRow {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  partOfSpeech: string | null
  audioUrl: string | null
  hasDetails: boolean
}

type EntryDetails = DictionaryEntry & {
  exampleSentences: ExampleSentence[]
  relatedEntries: { id: string; lemma: string }[]
}

interface PublicDictionaryProps {
  entries: PublicDictionaryRow[]
  symbols: ScriptSymbol[]
  /** Entries in the whole language (to tell "empty dictionary" from "no matches"). */
  languageTotal: number
  /** Entries matching the current search/tag. */
  total: number
  page: number
  totalPages: number
  pageSize: number
  initialQuery: string
  reversed: boolean
  activeTag: string | null
  voiceId?: string
  speed?: string
}

export function PublicDictionary({
  entries,
  symbols,
  languageTotal,
  total,
  page,
  totalPages,
  pageSize,
  initialQuery,
  reversed,
  activeTag,
  voiceId,
  speed,
}: PublicDictionaryProps) {
  const t = useTranslations("langPublic.dictionary")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, startTransition] = useTransition()

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [showLatin, setShowLatin] = useState(false)

  const [selected, setSelected] = useState<(Partial<EntryDetails> & { id: string; lemma: string }) | null>(null)
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle")
  const latestRequest = useRef(0)

  /** The URL is the source of truth for search, direction, tag and page. */
  const navigate = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (!("page" in changes)) params.delete("page")
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  // Submit the debounced query when it differs from what the server rendered.
  useEffect(() => {
    if (debouncedQuery.trim() !== initialQuery) navigate({ q: debouncedQuery.trim() || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate reads live search params
  }, [debouncedQuery])

  const openEntry = async (entry: { id: string; lemma: string }) => {
    const requestId = ++latestRequest.current
    setSelected((current) => (current?.id === entry.id ? current : entry))
    setDetailState("loading")
    try {
      const result = await getPublicDictionaryEntry(entry.id)
      if (requestId !== latestRequest.current) return // a newer click won
      if ("success" in result) {
        setSelected(result.data as EntryDetails)
        setDetailState("idle")
      } else {
        setDetailState("error")
      }
    } catch {
      if (requestId === latestRequest.current) setDetailState("error")
    }
  }

  const displayLemma = (lemma: string) => (showLatin ? transliterateToLatin(lemma, symbols) : lemma)

  if (languageTotal === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const relatedLemmas = Array.isArray(selected?.relatedWords)
    ? (selected!.relatedWords as unknown[]).filter((w): w is string => typeof w === "string")
    : []
  const selectedTags = Array.isArray(selected?.tags)
    ? (selected!.tags as unknown[]).filter((w): w is string => typeof w === "string")
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label={t("searchLabel")}
            placeholder={reversed ? t("searchPlaceholderReverse") : t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {isNavigating && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={reversed ? "default" : "outline"}
            size="sm"
            className="flex-1 justify-center gap-2 sm:flex-none sm:shrink-0"
            aria-pressed={reversed}
            onClick={() => navigate({ dir: reversed ? null : "meaning" })}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            {reversed ? t("directionReverse") : t("directionForward")}
          </Button>
          <TransliterationToggle onToggle={setShowLatin} defaultShowLatin={showLatin} />
        </div>
      </div>

      {activeTag && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("filteringByTag")}</span>
          <Badge variant="secondary" className="gap-1">
            {activeTag}
            <button
              type="button"
              onClick={() => navigate({ tag: null })}
              className="ml-1 rounded-sm hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("clearTagFilter")}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </Badge>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">{t("noMatches")}</p>
        </div>
      ) : (
        <>
          <div className={isNavigating ? "rounded-lg border opacity-60 transition-opacity" : "rounded-lg border transition-opacity"}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colWord")}</TableHead>
                  <TableHead>{t("colMeaning")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("colIpa")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colPos")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const shown = displayLemma(entry.lemma)
                  return (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openEntry(entry)}
                    >
                      <TableCell className="font-medium">
                        {/* The row stays clickable for the mouse; this button is the keyboard/AT target. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEntry(entry)
                          }}
                          aria-label={t("showDetails", { word: entry.lemma })}
                          className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className={!showLatin ? "font-custom-script text-lg" : ""} translate="no">
                            {shown}
                          </span>
                        </button>
                        {showLatin && shown !== entry.lemma && (
                          <span className="text-xs text-muted-foreground ml-2 font-custom-script" translate="no">
                            ({entry.lemma})
                          </span>
                        )}
                        {entry.hasDetails && (
                          <span className="ml-2 text-xs text-primary/60" title={t("hasDetails")} aria-hidden="true">•</span>
                        )}
                      </TableCell>
                      <TableCell>{entry.gloss}</TableCell>
                      <TableCell className="hidden font-ipa text-sm sm:table-cell">
                        {entry.ipa || entry.audioUrl ? (
                          <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {entry.ipa && <span>/{entry.ipa}/</span>}
                            <IPASpeaker ipa={entry.ipa || undefined} audioUrl={entry.audioUrl} size="sm" voiceId={voiceId} speed={speed} />
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {entry.partOfSpeech || "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground text-center" aria-live="polite">
            {t("showing", { from, to, total })}
          </p>
          <DictionaryPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(next) => navigate({ page: next > 1 ? String(next) : null })}
          />
        </>
      )}

      {/* Entry details */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="space-y-4 pb-4 border-b">
                <div>
                  <SheetTitle className="font-custom-script text-2xl" translate="no">
                    {displayLemma(selected.lemma)}
                  </SheetTitle>
                  {showLatin && displayLemma(selected.lemma) !== selected.lemma && (
                    <p className="text-sm text-muted-foreground font-custom-script mt-1" translate="no">
                      {selected.lemma}
                    </p>
                  )}
                  <SheetDescription className="sr-only">{selected.gloss ?? ""}</SheetDescription>
                </div>
                {(selected.ipa || selected.audioUrl || selected.partOfSpeech) && (
                  <div className="flex items-center gap-3">
                    {(selected.ipa || selected.audioUrl) && (
                      <div className="flex items-center gap-2 text-sm font-ipa bg-muted/50 px-2 py-1 rounded">
                        {selected.ipa && <span>/{selected.ipa}/</span>}
                        <IPASpeaker ipa={selected.ipa || undefined} audioUrl={selected.audioUrl} size="sm" voiceId={voiceId} speed={speed} />
                      </div>
                    )}
                    {selected.partOfSpeech && <Badge variant="secondary">{selected.partOfSpeech}</Badge>}
                  </div>
                )}
              </SheetHeader>

              <div className="space-y-6 pt-6">
                {selected.gloss && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2">{t("translation")}</h2>
                    <p className="text-lg">{selected.gloss}</p>
                  </div>
                )}

                {detailState === "loading" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("loadingDetails")}
                  </div>
                )}
                {detailState === "error" && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
                    <span>{t("detailsFailed")}</span>
                    <Button size="sm" variant="outline" onClick={() => openEntry(selected)}>
                      {tCommon("tryAgain")}
                    </Button>
                  </div>
                )}

                {selected.etymology && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                      {t("etymology")}
                    </h2>
                    <p className="text-sm italic text-foreground/80">{selected.etymology}</p>
                  </div>
                )}

                {relatedLemmas.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      {t("related")}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {relatedLemmas.map((word) => {
                        const target = selected.relatedEntries?.find((e) => e.lemma === word)
                        return target ? (
                          <button
                            key={word}
                            type="button"
                            onClick={() => openEntry(target)}
                            className="rounded-md border px-2.5 py-0.5 text-xs font-semibold font-custom-script hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            translate="no"
                          >
                            {word}
                          </button>
                        ) : (
                          <Badge key={word} variant="outline" className="font-custom-script" translate="no">
                            {word}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <StickyNote className="h-4 w-4" aria-hidden="true" />
                      {t("notes")}
                    </h2>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}

                {selectedTags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4" aria-hidden="true" />
                      {t("tags")}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelected(null)
                            setSearchQuery("")
                            navigate({ tag, q: null })
                          }}
                          className="rounded-md border px-2.5 py-0.5 text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <EtymologyTree entry={selected} onSelectEntry={(e) => openEntry(e)} />

                {selected.exampleSentences && selected.exampleSentences.length > 0 && (
                  <ExampleSentences
                    examples={selected.exampleSentences}
                    dictionaryEntryId={selected.id}
                    languageId={selected.languageId ?? ""}
                    canEdit={false}
                  />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
