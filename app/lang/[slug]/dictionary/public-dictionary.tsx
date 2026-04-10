"use client"

import { useState, useMemo } from "react"
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Search, BookOpen, Link2, StickyNote, ArrowLeftRight, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransliterationToggle } from "@/components/transliteration-toggle"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import { IPASpeaker } from "@/components/ipa-speaker"
import { ExampleSentences } from "@/components/dictionary/example-sentences"
import { EtymologyTree } from "@/components/dictionary/etymology-tree"
import type { DictionaryEntry, ScriptSymbol, ExampleSentence } from "@prisma/client"

type DictionaryEntryWithExamples = DictionaryEntry & {
  exampleSentences: ExampleSentence[]
}

interface PublicDictionaryProps {
  entries: DictionaryEntryWithExamples[]
  symbols: ScriptSymbol[]
  voiceId?: string
  speed?: string
}

export function PublicDictionary({ entries, symbols, voiceId, speed }: PublicDictionaryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showLatin, setShowLatin] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntryWithExamples | null>(null)
  const [reversed, setReversed] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const handleTagClick = (tag: string) => {
    setActiveTag(tag)
    setSearchQuery("")
    setSelectedEntry(null)
  }

  const clearTagFilter = () => {
    setActiveTag(null)
  }

  // Filter entries based on search query, tag filter, and direction
  const filteredEntries = useMemo(() => {
    let results = entries

    // Apply tag filter first
    if (activeTag) {
      results = results.filter((entry) =>
        Array.isArray(entry.tags) && (entry.tags as string[]).includes(activeTag)
      )
    }

    if (!searchQuery.trim()) {
      // When reversed with no search, sort by gloss
      if (reversed) {
        return [...results].sort((a, b) => a.gloss.localeCompare(b.gloss))
      }
      return results
    }

    const query = searchQuery.toLowerCase()
    results = results.filter((entry) => {
      if (reversed) {
        // Reverse mode: search gloss first, then lemma
        return (
          entry.gloss.toLowerCase().includes(query) ||
          entry.lemma.toLowerCase().includes(query)
        )
      }
      return (
        entry.lemma.toLowerCase().includes(query) ||
        entry.gloss.toLowerCase().includes(query) ||
        (entry.ipa && entry.ipa.toLowerCase().includes(query)) ||
        (entry.partOfSpeech && entry.partOfSpeech.toLowerCase().includes(query))
      )
    })

    if (reversed) {
      // In reverse mode, prioritize gloss matches
      results.sort((a, b) => {
        const aGloss = a.gloss.toLowerCase().includes(query) ? 0 : 1
        const bGloss = b.gloss.toLowerCase().includes(query) ? 0 : 1
        return aGloss - bGloss || a.gloss.localeCompare(b.gloss)
      })
    }

    return results
  }, [entries, searchQuery, reversed, activeTag])

  // Check if entry has additional details
  const hasDetails = (entry: DictionaryEntryWithExamples) => {
    return (
      entry.etymology ||
      entry.notes ||
      (Array.isArray(entry.relatedWords) && (entry.relatedWords as string[]).length > 0) ||
      entry.exampleSentences.length > 0
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No dictionary entries have been added yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={reversed ? "Search by English meaning..." : "Search by lemma, gloss, IPA, or part of speech..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={reversed ? "default" : "outline"}
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setReversed(!reversed)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {reversed ? "English → Conlang" : "Conlang → English"}
        </Button>
        <TransliterationToggle
          onToggle={setShowLatin}
          defaultShowLatin={showLatin}
        />
      </div>

      {activeTag && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtering by tag:</span>
          <Badge variant="secondary" className="gap-1">
            {activeTag}
            <button
              type="button"
              onClick={clearTagFilter}
              className="ml-1 hover:text-destructive transition-colors"
              aria-label="Clear tag filter"
            >
              &times;
            </button>
          </Badge>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No entries match your search.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lemma</TableHead>
                  <TableHead>Gloss</TableHead>
                  <TableHead>IPA</TableHead>
                  <TableHead>Part of Speech</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const displayLemma = showLatin
                    ? transliterateToLatin(entry.lemma, symbols)
                    : entry.lemma
                  const entryHasDetails = hasDetails(entry)
                  return (
                    <TableRow
                      key={entry.id}
                      className={entryHasDetails ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                      onClick={() => entryHasDetails && setSelectedEntry(entry)}
                    >
                      <TableCell className="font-medium">
                        <span className={!showLatin ? "font-custom-script text-lg" : ""}>
                          {displayLemma}
                        </span>
                        {showLatin && displayLemma !== entry.lemma && (
                          <span className="text-xs text-muted-foreground ml-2 font-custom-script">
                            ({entry.lemma})
                          </span>
                        )}
                        {entryHasDetails && (
                          <span className="ml-2 text-xs text-primary/60">•</span>
                        )}
                      </TableCell>
                      <TableCell>{entry.gloss}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.ipa ? (
                          <span className="flex items-center gap-2">
                            <span>/{entry.ipa}/</span>
                            <IPASpeaker ipa={entry.ipa} size="sm" voiceId={voiceId} speed={speed} />
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.partOfSpeech || "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {filteredEntries.length < entries.length && (
            <p className="text-sm text-muted-foreground text-center">
              Showing {filteredEntries.length} of {entries.length} entries
            </p>
          )}
        </>
      )}

      {/* Entry Details Sheet */}
      <Sheet open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <SheetContent className="overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {selectedEntry && (
            <>
              <SheetHeader className="space-y-4 pb-4 border-b">
                <div>
                  <SheetTitle className="font-custom-script text-2xl">
                    {showLatin
                      ? transliterateToLatin(selectedEntry.lemma, symbols)
                      : selectedEntry.lemma
                    }
                  </SheetTitle>
                  {showLatin && transliterateToLatin(selectedEntry.lemma, symbols) !== selectedEntry.lemma && (
                    <p className="text-sm text-muted-foreground font-custom-script mt-1">
                      {selectedEntry.lemma}
                    </p>
                  )}
                </div>
                {(selectedEntry.ipa || selectedEntry.partOfSpeech) && (
                  <div className="flex items-center gap-3">
                    {selectedEntry.ipa && (
                      <div className="flex items-center gap-2 text-sm font-mono bg-muted/50 px-2 py-1 rounded">
                        <span>/{selectedEntry.ipa}/</span>
                        <IPASpeaker ipa={selectedEntry.ipa} size="sm" voiceId={voiceId} speed={speed} />
                      </div>
                    )}
                    {selectedEntry.partOfSpeech && (
                      <Badge variant="secondary">{selectedEntry.partOfSpeech}</Badge>
                    )}
                  </div>
                )}
              </SheetHeader>

              <div className="space-y-6 pt-6">
                {/* Gloss/Translation */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Translation</h4>
                  <p className="text-lg">{selectedEntry.gloss}</p>
                </div>

                {/* Etymology */}
                {selectedEntry.etymology && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Etymology
                    </h4>
                    <p className="text-sm italic text-foreground/80">
                      {selectedEntry.etymology}
                    </p>
                  </div>
                )}

                {/* Related Words */}
                {Array.isArray(selectedEntry.relatedWords) && (selectedEntry.relatedWords as string[]).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Related Words
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedEntry.relatedWords as string[]).map((word) => (
                        <Badge
                          key={word}
                          variant="outline"
                          className="font-custom-script cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => {
                            // Find and select the related entry
                            const relatedEntry = entries.find(e => e.lemma === word)
                            if (relatedEntry) {
                              setSelectedEntry(relatedEntry)
                            }
                          }}
                        >
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedEntry.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Notes
                    </h4>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                      {selectedEntry.notes}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {Array.isArray(selectedEntry.tags) && (selectedEntry.tags as string[]).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedEntry.tags as string[]).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/40 transition-colors"
                          onClick={() => {
                            handleTagClick(tag)
                            setSelectedEntry(null)
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etymology Tree */}
                <EtymologyTree
                  entry={selectedEntry}
                  allEntries={entries}
                  onSelectEntry={(e) => {
                    const fullEntry = entries.find(x => x.id === e.id)
                    if (fullEntry) setSelectedEntry(fullEntry)
                  }}
                />

                {/* Example Sentences */}
                {selectedEntry.exampleSentences.length > 0 && (
                  <ExampleSentences
                    examples={selectedEntry.exampleSentences}
                    dictionaryEntryId={selectedEntry.id}
                    languageId={selectedEntry.languageId}
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

