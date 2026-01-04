"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Trash2, Volume2 } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"
import { Badge } from "@/components/ui/badge"

interface DictionaryTableMobileProps {
  entries: DictionaryEntry[]
  symbols: ScriptSymbol[]
  selectedEntries: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  onEdit: (entry: DictionaryEntry) => void
  onDelete: (entry: DictionaryEntry) => void
  showLatin: boolean
  enableAudio: boolean
}

export function DictionaryTableMobile({
  entries,
  symbols,
  selectedEntries,
  onSelectionChange,
  onEdit,
  onDelete,
  showLatin,
  enableAudio,
}: DictionaryTableMobileProps) {
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedEntries)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    onSelectionChange(newSelected)
  }

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const isSelected = selectedEntries.has(entry.id)
        const latin = showLatin ? transliterateToLatin(entry.lemma, symbols) : null

        return (
          <Card
            key={entry.id}
            className={`border transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border/60"
              }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleSelectOne(entry.id, checked === true)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-serif mb-1 break-words">
                      {entry.lemma}
                    </CardTitle>
                    {latin && (
                      <p className="text-sm text-muted-foreground mb-1 font-mono">
                        {latin}
                      </p>
                    )}
                    {entry.ipa && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-muted-foreground font-mono">
                          /{entry.ipa}/
                        </span>
                        {enableAudio && (
                          <IPASpeaker ipa={entry.ipa} size="sm" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(entry)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {entry.gloss}
                  </p>
                </div>
                {entry.partOfSpeech && (
                  <div>
                    <Badge variant="secondary" className="text-xs">
                      {entry.partOfSpeech}
                    </Badge>
                  </div>
                )}
                {entry.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {entry.notes}
                    </p>
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
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

