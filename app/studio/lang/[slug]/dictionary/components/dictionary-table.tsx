"use client"

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
import { Pencil, Trash2 } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import { ContextualHelp } from "@/components/contextual-help"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"

interface DictionaryTableProps {
  entries: DictionaryEntry[]
  selectedEntries: Set<string>
  onSelectChange: (selected: Set<string>) => void
  onEdit: (entry: DictionaryEntry) => void
  onDelete: (id: string) => void
  showLatin: boolean
  symbols: ScriptSymbol[]
  isPending?: boolean
}

export function DictionaryTable({
  entries,
  selectedEntries,
  onSelectChange,
  onEdit,
  onDelete,
  showLatin,
  symbols,
  isPending,
}: DictionaryTableProps) {
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
              <TableRow key={entry.id} className={isSelected ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectOne(entry.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {displayLemma}
                  {showLatin && displayLemma !== entry.lemma && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({entry.lemma})
                    </span>
                  )}
                  {entry.etymology && (
                    <span className="text-xs text-muted-foreground block mt-1 line-clamp-1">
                      {entry.etymology}
                    </span>
                  )}
                </TableCell>
                <TableCell>{entry.gloss}</TableCell>
                <TableCell className="font-mono text-sm">
                  {entry.ipa ? (
                    <span className="flex items-center gap-2">
                      <span>/{entry.ipa}/</span>
                      <IPASpeaker ipa={entry.ipa} size="sm" />
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
                      onClick={() => onDelete(entry.id)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

