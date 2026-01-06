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
import { Search } from "lucide-react"
import { TransliterationToggle } from "@/components/transliteration-toggle"
import { transliterateToLatin } from "@/lib/utils/transliterate"
import { IPASpeaker } from "@/components/ipa-speaker"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"

interface PublicDictionaryProps {
  entries: DictionaryEntry[]
  symbols: ScriptSymbol[]
}

export function PublicDictionary({ entries, symbols }: PublicDictionaryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showLatin, setShowLatin] = useState(false)

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return entries
    }

    const query = searchQuery.toLowerCase()
    return entries.filter(
      (entry) =>
        entry.lemma.toLowerCase().includes(query) ||
        entry.gloss.toLowerCase().includes(query) ||
        (entry.ipa && entry.ipa.toLowerCase().includes(query)) ||
        (entry.partOfSpeech && entry.partOfSpeech.toLowerCase().includes(query))
    )
  }, [entries, searchQuery])

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
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by lemma, gloss, IPA, or part of speech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <TransliterationToggle
          onToggle={setShowLatin}
          defaultShowLatin={showLatin}
        />
      </div>

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
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        <span className={!showLatin ? "font-custom-script text-lg" : ""}>
                          {displayLemma}
                        </span>
                        {showLatin && displayLemma !== entry.lemma && (
                          <span className="text-xs text-muted-foreground ml-2 font-custom-script">
                            ({entry.lemma})
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
    </div>
  )
}

