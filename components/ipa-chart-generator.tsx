"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table2 } from "lucide-react"
import { toast } from "sonner"

interface ScriptSymbol {
  id: string
  symbol: string
  ipa: string | null
  name: string | null
}

interface IpaChartGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbols: ScriptSymbol[]
  onInsert: (html: string) => void
}

export function IpaChartGenerator({
  open,
  onOpenChange,
  symbols,
  onInsert,
}: IpaChartGeneratorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState("consonants")

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const selectAll = () => {
    // Select all symbols that have IPA defined
    const ids = symbols.filter(s => s.ipa).map(s => s.id)
    setSelectedIds(new Set(ids))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const generateTable = () => {
    const selectedSymbols = symbols.filter(s => selectedIds.has(s.id) && s.ipa)

    if (selectedSymbols.length === 0) {
      toast.error("Please select at least one symbol with IPA to generate a chart")
      return
    }

    // Basic categorization (simplified)
    const vowels = selectedSymbols.filter(s =>
      /^[aeiouyøæɑɔɛɪʊəɨʉɯʏoeɛ̃ɑ̃ɔ̃iːuː]/.test(s.ipa || "")
    )
    const consonants = selectedSymbols.filter(s => !vowels.includes(s))

    let html = ""

    if (consonants.length > 0) {
      html += `<h3>Consonants</h3>
      <table>
        <thead>
          <tr>
            <th>Place / Manner</th>
            <th>Labial</th>
            <th>Coronal</th>
            <th>Dorsal</th>
            <th>Laryngeal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Plosive</strong></td>
            <td>${consonants.filter(c => /[pb]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[td]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[kgq]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[ʔ]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
          </tr>
          <tr>
            <td><strong>Nasal</strong></td>
            <td>${consonants.filter(c => /[m]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[n]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[ŋɲ]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td></td>
          </tr>
          <tr>
            <td><strong>Fricative</strong></td>
            <td>${consonants.filter(c => /[fvɸβ]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[szʃʒθð]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[xɣχʁ]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[hɦ]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
          </tr>
           <tr>
            <td><strong>Approximant</strong></td>
            <td>${consonants.filter(c => /[wʋ]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td>${consonants.filter(c => /[lɹj]/.test(c.ipa || "")).map(c => c.symbol).join(" ")}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <p><br></p>`
    }

    if (vowels.length > 0) {
      html += `<h3>Vowels</h3>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Front</th>
            <th>Central</th>
            <th>Back</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>High</strong></td>
            <td>${vowels.filter(v => /[iy]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
            <td>${vowels.filter(v => /[ɨʉ]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
            <td>${vowels.filter(v => /[uɯ]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
          </tr>
          <tr>
            <td><strong>Mid</strong></td>
            <td>${vowels.filter(v => /[eøɛœ]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
            <td>${vowels.filter(v => /[ə]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
            <td>${vowels.filter(v => /[oɔɤʌ]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
          </tr>
          <tr>
            <td><strong>Low</strong></td>
            <td>${vowels.filter(v => /[æa]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
            <td></td>
            <td>${vowels.filter(v => /[ɑɒ]/.test(v.ipa || "")).map(v => v.symbol).join(" ")}</td>
          </tr>
        </tbody>
      </table>`
    }

    if (!html) {
      // Fallback for symbols not matching simplified regex
      html = `<h3>Phonemes</h3>
      <ul>
        ${selectedSymbols.map(s => `<li><strong>${s.symbol}</strong> /${s.ipa}/</li>`).join("")}
      </ul>`
    }

    onInsert(html)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate IPA Chart</DialogTitle>
          <DialogDescription>
            Select the phonemes to include in your chart. The chart will be generated using standard IPA layout.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 py-4">
          <div className="flex justify-end gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>Clear</Button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain border rounded-md p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {symbols.filter(s => s.ipa).map(symbol => (
                <div key={symbol.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`symbol-${symbol.id}`}
                    checked={selectedIds.has(symbol.id)}
                    onCheckedChange={() => toggleSelection(symbol.id)}
                  />
                  <Label htmlFor={`symbol-${symbol.id}`} className="cursor-pointer">
                    <span className="font-bold">{symbol.symbol}</span>
                    <span className="text-muted-foreground ml-2 text-xs font-mono">/{symbol.ipa}/</span>
                  </Label>
                </div>
              ))}
              {symbols.filter(s => !s.ipa).length > 0 && (
                <div className="col-span-full pt-4 border-t mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Symbols without IPA (add IPA in Alphabet settings to use here):</p>
                  <div className="flex flex-wrap gap-2">
                    {symbols.filter(s => !s.ipa).map(s => (
                      <span key={s.id} className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">{s.symbol}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={generateTable}>Insert Chart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
