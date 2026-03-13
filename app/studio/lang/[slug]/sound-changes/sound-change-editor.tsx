"use client"

import { useState, useMemo, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Play,
  Save,
  RotateCcw,
  ArrowRight,
  Check,
  Copy,
  Info,
  Zap,
  FileText,
} from "lucide-react"
import { parseRules, applyPipeline, type SoundChangeResult } from "@/lib/utils/sound-change"
import { updateLanguageMetadata } from "@/app/actions/language"

interface SoundChangeEditorProps {
  languageId: string
  languageName: string
  entries: { id: string; lemma: string; gloss: string; ipa: string | null }[]
  savedRules: string
  phonology: Record<string, any>
}

const EXAMPLE_RULES = `// Grimm's Law (simplified)
// p → f
// t → θ
// k → h

// Lenition between vowels
// b → v / V_V
// d → ð / V_V
// g → ɣ / V_V

// Final devoicing
// b → p / _#
// d → t / _#
// g → k / _#`

export function SoundChangeEditor({
  languageId,
  languageName,
  entries,
  savedRules,
  phonology,
}: SoundChangeEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Rule editor
  const [rulesText, setRulesText] = useState(savedRules || "")
  const [testWords, setTestWords] = useState("")

  // Parse rules from text
  const rules = useMemo(() => parseRules(rulesText), [rulesText])

  // Build custom vowel/consonant sets from phonology if available
  const vowels = useMemo(() => {
    if (phonology?.vowels && Array.isArray(phonology.vowels)) {
      return new Set<string>(phonology.vowels)
    }
    return undefined
  }, [phonology])

  const consonants = useMemo(() => {
    if (phonology?.consonants && Array.isArray(phonology.consonants)) {
      return new Set<string>(phonology.consonants)
    }
    return undefined
  }, [phonology])

  // Preview results on test words
  const testResults = useMemo<SoundChangeResult[]>(() => {
    if (!testWords.trim()) return []
    const words = testWords
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean)
    return words.map((word) => applyPipeline(word, rules, vowels, consonants))
  }, [testWords, rules, vowels, consonants])

  // Preview on dictionary entries
  const dictionaryResults = useMemo<SoundChangeResult[]>(() => {
    if (rules.length === 0) return []
    return entries.slice(0, 100).map((entry) =>
      applyPipeline(entry.lemma, rules, vowels, consonants)
    )
  }, [entries, rules, vowels, consonants])

  const changedCount = dictionaryResults.filter(
    (r) => r.changed !== r.original
  ).length

  // Save rules to language metadata
  const handleSave = useCallback(async () => {
    try {
      await updateLanguageMetadata(languageId, {
        soundChangeRules: rulesText,
      })
      toast.success("Sound change rules saved!")
      startTransition(() => router.refresh())
    } catch {
      toast.error("Failed to save rules")
    }
  }, [languageId, rulesText, router])

  // Copy results to clipboard
  const handleCopyResults = useCallback(() => {
    const text = dictionaryResults
      .filter((r) => r.changed !== r.original)
      .map((r) => `${r.original} → ${r.changed}`)
      .join("\n")
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard!")
  }, [dictionaryResults])

  // Export as TSV
  const handleExport = useCallback(() => {
    const header = "Original\tChanged\tRules Applied"
    const rows = dictionaryResults
      .filter((r) => r.changed !== r.original)
      .map((r) => `${r.original}\t${r.changed}\t${r.rulesApplied.join("; ")}`)
    const text = [header, ...rows].join("\n")

    const blob = new Blob([text], { type: "text/tab-separated-values" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${languageName}-sound-changes.tsv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported as TSV!")
  }, [dictionaryResults, languageName])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Rule Editor */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Rules
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRulesText(EXAMPLE_RULES)}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Load Example
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder={`Enter rules, one per line:\na → e / _#\nk → tʃ / _i\ns → ∅ / V_V\n\n// Lines starting with // are comments`}
              className="font-mono text-sm min-h-[300px] resize-y"
              spellCheck={false}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {rules.length} rule{rules.length !== 1 ? "s" : ""} parsed
              </span>
              <div className="flex items-center gap-1.5">
                <Info className="h-3 w-3" />
                <span>V = vowel, C = consonant, # = boundary, ∅ = delete</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Words */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              Test Words
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={testWords}
              onChange={(e) => setTestWords(e.target.value)}
              placeholder="Type words to test (comma-separated)..."
              className="font-serif"
            />
            {testResults.length > 0 && (
              <div className="space-y-1.5">
                {testResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-muted/50"
                  >
                    <span className="font-serif">{result.original}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span
                      className={`font-serif font-medium ${
                        result.changed !== result.original
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {result.changed}
                    </span>
                    {result.rulesApplied.length > 0 && (
                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                        {result.rulesApplied.length} rule{result.rulesApplied.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parsed Rules Preview */}
        {rules.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Parsed Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {rules.map((rule, i) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded bg-muted/30"
                  >
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-amber-600 dark:text-amber-400">{rule.target}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-green-600 dark:text-green-400">
                      {rule.replacement || "∅"}
                    </span>
                    {(rule.leftEnv || rule.rightEnv) && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {rule.leftEnv || ""}_{rule.rightEnv || ""}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Results Preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Dictionary Preview
                {changedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {changedCount} changed
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyResults}
                  disabled={changedCount === 0}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={changedCount === 0}
                  className="text-xs"
                >
                  Export TSV
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p>Add rules on the left to see how they transform your dictionary.</p>
                <p className="mt-1 text-xs">
                  Example: <code className="px-1 py-0.5 rounded bg-muted">a → e / _#</code>
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Original</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Changed</TableHead>
                      <TableHead className="text-right">Gloss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dictionaryResults.map((result, i) => {
                      const isChanged = result.changed !== result.original
                      const entry = entries[i]
                      return (
                        <TableRow
                          key={entry.id}
                          className={isChanged ? "" : "opacity-40"}
                        >
                          <TableCell className="font-serif">
                            {result.original}
                          </TableCell>
                          <TableCell>
                            {isChanged && (
                              <ArrowRight className="h-3 w-3 text-primary" />
                            )}
                          </TableCell>
                          <TableCell
                            className={`font-serif font-medium ${
                              isChanged ? "text-primary" : ""
                            }`}
                          >
                            {result.changed}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {entry.gloss}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {changedCount > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{entries.length}</div>
              <div className="text-xs text-muted-foreground">Total Words</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-primary">{changedCount}</div>
              <div className="text-xs text-muted-foreground">Changed</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">
                {Math.round((changedCount / entries.length) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Affected</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
