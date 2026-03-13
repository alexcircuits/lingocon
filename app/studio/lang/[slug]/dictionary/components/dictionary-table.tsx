"use client"

import React, { useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Trash2, GitFork, ChevronDown, ChevronRight, BookOpen, Tag, Link2 } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import { ContextualHelp } from "@/components/contextual-help"
import { EtymologyTree } from "@/components/dictionary/etymology-tree"
import { Badge } from "@/components/ui/badge"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"

interface DictionaryTableProps {
  entries: (DictionaryEntry & {
    sourceEntry?: { id: string; lemma: string; language?: { name: string; slug: string } } | null
  })[]
  selectedEntries: Set<string>
  onSelectChange: (selected: Set<string>) => void
  onEdit: (entry: DictionaryEntry) => void
  onDelete: (id: string) => void
  onDerive: (entry: DictionaryEntry) => void
  showLatin: boolean
  symbols: ScriptSymbol[]
  isPending?: boolean
  ttsSettings?: {
    voiceId: string
    speed: string
  }
  allEntries?: DictionaryEntry[]
}

export function DictionaryTable({
  entries,
  selectedEntries,
  onSelectChange,
  onEdit,
  onDelete,
  onDerive,
  showLatin,
  symbols,
  isPending,
  ttsSettings,
  allEntries = [],
}: DictionaryTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(new Set(entries.map((e) => e.id)))
    } else {
      onSelectChange(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedEntries)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    onSelectChange(newSelected)
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No entries match your search.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedEntries.size === entries.length && entries.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <ContextualHelp
                  content="Select all entries for bulk operations like editing or exporting."
                  variant="icon"
                />
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                Lemma
                <ContextualHelp
                  content="The dictionary form or headword of the entry."
                  variant="icon"
                />
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                Gloss
                <ContextualHelp
                  content="The translation or definition of the word."
                  variant="icon"
                />
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                IPA
                <ContextualHelp
                  content="International Phonetic Alphabet pronunciation. Click the speaker icon to hear it."
                  variant="icon"
                />
              </div>
            </TableHead>
            <TableHead>Part of Speech</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const displayLemma = showLatin
              ? transliterateToLatin(entry.lemma, symbols)
              : entry.lemma
            const isSelected = selectedEntries.has(entry.id)

            return (
              <React.Fragment key={entry.id}>
              <TableRow className={isSelected ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectOne(entry.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="flex items-center gap-1 text-left hover:text-primary transition-colors group"
                  >
                    {expandedId === entry.id ? (
                      <ChevronDown className="h-3 w-3 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                    )}
                    <span className={!showLatin ? "font-custom-script text-base" : ""}>
                      {displayLemma}
                    </span>
                  </button>
                  {showLatin && displayLemma !== entry.lemma && (
                    <span className="text-xs text-muted-foreground ml-2 font-custom-script">
                      ({entry.lemma})
                    </span>
                  )}
                  {entry.etymology && (
                    <span className="text-xs text-muted-foreground block mt-1 line-clamp-1">
                      {entry.etymology}
                    </span>
                  )}
                  {entry.sourceEntryId && entry.sourceEntry && (
                    <div className="flex items-center gap-1 mt-1">
                      <Link2 className="h-2.5 w-2.5 text-purple-500" />
                      <span className="text-[10px] text-purple-500/80">
                        from <span className="font-serif font-medium">{entry.sourceEntry.lemma}</span>
                        {entry.sourceEntry.language && (
                          <span className="text-muted-foreground"> ({entry.sourceEntry.language.name})</span>
                        )}
                      </span>
                    </div>
                  )}
                  {Array.isArray(entry.relatedWords) && (entry.relatedWords as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(entry.relatedWords as string[]).map((word) => (
                        <span
                          key={word}
                          className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border/50"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  )}
                  {Array.isArray(entry.tags) && (entry.tags as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(entry.tags as string[]).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>{entry.gloss}</TableCell>
                <TableCell className="font-mono text-sm">
                  {entry.ipa ? (
                    <span className="flex items-center gap-2">
                      <span>/{entry.ipa}/</span>
                      <IPASpeaker
                        ipa={entry.ipa}
                        size="sm"
                        voiceId={ttsSettings?.voiceId}
                        speed={ttsSettings?.speed}
                      />
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.partOfSpeech || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(entry)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDerive(entry)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Derive Word"
                    >
                      <GitFork className="h-4 w-4" />
                    </Button>
                    <Button

                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(entry.id)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedId === entry.id && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={6} className="p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Left: Etymology & Notes */}
                      <div className="space-y-3">
                        {entry.etymology && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                              <BookOpen className="h-3 w-3" />
                              Etymology
                            </h4>
                            <p className="text-sm italic text-foreground/80">
                              {entry.etymology}
                            </p>
                          </div>
                        )}
                        {entry.notes && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1">Notes</h4>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-3">
                              {entry.notes}
                            </p>
                          </div>
                        )}
                        {Array.isArray(entry.tags) && (entry.tags as string[]).length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                              <Tag className="h-3 w-3" />
                              Tags
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {(entry.tags as string[]).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {!entry.etymology && !entry.notes && (!Array.isArray(entry.tags) || (entry.tags as string[]).length === 0) && (
                          <p className="text-sm text-muted-foreground italic">No etymology or notes recorded.</p>
                        )}
                      </div>

                      {/* Right: Derivation Tree */}
                      <div>
                        <EtymologyTree
                          entry={entry}
                          allEntries={allEntries.length > 0 ? allEntries : entries}
                          onSelectEntry={(e) => {
                            setExpandedId(e.id)
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

