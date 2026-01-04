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
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"
import { Skeleton } from "@/components/ui/skeleton"

interface DictionaryTableProps {
  entries: DictionaryEntry[]
  symbols: ScriptSymbol[]
  isLoading?: boolean
  selectedEntries: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  onEdit: (entry: DictionaryEntry) => void
  onDelete: (entry: DictionaryEntry) => void
  showLatin: boolean
  enableAudio: boolean
}

export function DictionaryTable({
  entries,
  symbols,
  isLoading = false,
  selectedEntries,
  onSelectionChange,
  onEdit,
  onDelete,
  showLatin,
  enableAudio,
}: DictionaryTableProps) {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(entries.map((e) => e.id)))
    } else {
      onSelectionChange(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedEntries)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    onSelectionChange(newSelected)
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><Skeleton className="h-4 w-4" /></TableHead>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead className="w-32"><Skeleton className="h-4 w-16" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-secondary/30">
          <TableRow>
            <TableHead className="w-12 text-center">
              <Checkbox
                checked={entries.length > 0 && selectedEntries.size === entries.length}
                onCheckedChange={handleSelectAll}
                disabled={entries.length === 0}
              />
            </TableHead>
            <TableHead className="font-semibold">Lemma</TableHead>
            <TableHead className="font-semibold">Gloss</TableHead>
            <TableHead className="font-semibold">IPA</TableHead>
            <TableHead className="font-semibold">Part of Speech</TableHead>
            <TableHead className="w-32 font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No entries found
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => {
              const displayLemma = showLatin
                ? transliterateToLatin(entry.lemma, symbols)
                : entry.lemma
              const isSelected = selectedEntries.has(entry.id)
              
              return (
                <TableRow 
                  key={entry.id} 
                  className={`group transition-colors ${isSelected ? "bg-muted/50" : "hover:bg-muted/30"}`}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(entry.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-base">
                      {displayLemma}
                      {showLatin && displayLemma !== entry.lemma && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({entry.lemma})
                        </span>
                      )}
                    </div>
                    {entry.etymology && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                        from {entry.etymology}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.gloss}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {entry.ipa ? (
                      <div className="flex items-center gap-2 bg-secondary/30 w-fit px-2 py-0.5 rounded">
                        <span>/{entry.ipa}/</span>
                        {enableAudio && (
                          <IPASpeaker 
                            ipa={entry.ipa} 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity" 
                          />
                        )}
                      </div>
                    ) : (
                      <span className="opacity-30">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.partOfSpeech ? (
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                        {entry.partOfSpeech}
                      </span>
                    ) : (
                      <span className="text-muted-foreground opacity-30">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(entry)}
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(entry)}
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
