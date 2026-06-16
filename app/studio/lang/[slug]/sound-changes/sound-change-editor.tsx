"use client"

import { useState, useMemo, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
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
  Wand2,
  AlertTriangle,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { parseRules, type SoundChangeResult } from "@/lib/utils/sound-change"
import { useSoundChangeEngine } from "@/lib/linguistics/use-sound-change-engine"
import { cn } from "@/lib/utils"
import { updateLanguageMetadata } from "@/app/actions/language"
import { applySoundChangesToDictionary } from "@/app/actions/apply-sound-changes"

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
  const t = useTranslations("studio.soundChanges")
  const [isPending, startTransition] = useTransition()
  const [isApplying, setIsApplying] = useState(false)

  // Rule editor
  const [rulesText, setRulesText] = useState(savedRules || "")
  const [testWords, setTestWords] = useState("")

  // Parse rules from text (used for the rule count + empty checks)
  const rules = useMemo(() => parseRules(rulesText), [rulesText])

  // Sound-change engine: Go→WASM core when loaded, pure-TS fallback otherwise.
  const engine = useSoundChangeEngine()

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
    return engine.batchApply(words, rulesText, vowels, consonants)
  }, [testWords, rulesText, vowels, consonants, engine])

  // Preview on dictionary entries (cap at 200 for performance)
  const PREVIEW_LIMIT = 200
  const dictionaryResults = useMemo<SoundChangeResult[]>(() => {
    if (rules.length === 0) return []
    const words = entries.slice(0, PREVIEW_LIMIT).map((entry) => entry.lemma)
    return engine.batchApply(words, rulesText, vowels, consonants)
  }, [entries, rules.length, rulesText, vowels, consonants, engine])

  const changedCount = dictionaryResults.filter(
    (r) => r.changed !== r.original
  ).length

  // Save rules to language metadata
  const handleSave = useCallback(async () => {
    try {
      await updateLanguageMetadata(languageId, {
        soundChangeRules: rulesText,
      })
      toast.success(t("rulesSaved"))
      startTransition(() => router.refresh())
    } catch {
      toast.error(t("saveFailed"))
    }
  }, [languageId, rulesText, router])

  // Copy results to clipboard
  const handleCopyResults = useCallback(() => {
    const text = dictionaryResults
      .filter((r) => r.changed !== r.original)
      .map((r) => `${r.original} → ${r.changed}`)
      .join("\n")
    navigator.clipboard.writeText(text)
    toast.success(t("copiedToClipboard"))
  }, [dictionaryResults])

  // Apply rules to the actual dictionary (irreversible)
  const handleApplyToDictionary = useCallback(async () => {
    setIsApplying(true)
    try {
      const result = await applySoundChangesToDictionary(languageId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(t("appliedToast", { applied: result.data.applied, unchanged: result.data.unchanged }))
        startTransition(() => router.refresh())
      }
    } catch {
      toast.error(t("applyFailed"))
    } finally {
      setIsApplying(false)
    }
  }, [languageId, router])

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
    toast.success(t("exportedToast"))
  }, [dictionaryResults, languageName])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Rule Editor */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {t("rules")}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRulesText(EXAMPLE_RULES)}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t("loadExample")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {t("save")}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder={t("rulesPlaceholder")}
              className="font-mono text-sm min-h-[200px] sm:min-h-[300px] resize-y"
              spellCheck={false}
            />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-between">
              <span>
                {t("rulesParsed", { count: rules.length })}
              </span>
              <div className="flex items-center gap-1.5">
                <Info className="h-3 w-3" />
                <span>{t("legend")}</span>
              </div>
            </div>
            {rules.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    disabled={isApplying || changedCount === 0}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {isApplying ? t("applying") : t("applyToDict", { count: changedCount })}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      {t("applyTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <span className="block">
                        {t("applyDescStart", { count: changedCount })}
                      </span>
                      <span className="block text-amber-600 font-medium">
                        {t("applyDescEnd")}
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleApplyToDictionary}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {t("applyChanges")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>

        {/* Test Words */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              {t("testWords")}
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  engine.source === "wasm"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}
                title={
                  engine.source === "wasm"
                    ? "Powered by the Go→WASM linguistics core"
                    : "Using the JavaScript engine (WASM core not loaded)"
                }
              >
                {engine.source}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={testWords}
              onChange={(e) => setTestWords(e.target.value)}
              placeholder={t("testWordsPlaceholder")}
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
                        {t("ruleSuffix", { count: result.rulesApplied.length })}
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
              <CardTitle className="text-base font-medium">{t("parsedRules")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {rules.map((rule, i) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center gap-2 text-xs font-mono px-2 py-1 rounded bg-muted/30"
                  >
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-amber-600 dark:text-amber-400">{rule.target}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <span className="text-green-600 dark:text-green-400">
                      {rule.replacement || "∅"}
                    </span>
                    {(rule.leftEnv || rule.rightEnv) && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="min-w-0 break-all text-blue-600 dark:text-blue-400">
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
            <CardTitle className="text-base font-medium flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t("dictionaryPreview")}
                {changedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {t("changed", { count: changedCount })}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyResults}
                  disabled={changedCount === 0}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {t("copy")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={changedCount === 0}
                  className="text-xs"
                >
                  {t("exportTsv")}
                </Button>
              </div>
            </CardTitle>
            {entries.length > PREVIEW_LIMIT && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {t("previewLimit", { limit: PREVIEW_LIMIT, total: entries.length })}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p>{t("noRulesHint")}</p>
                <p className="mt-1 text-xs">
                  {t("exampleLabel")} <code className="px-1 py-0.5 rounded bg-muted">a → e / _#</code>
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="overflow-x-auto scroll-fade-x">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("original")}</TableHead>
                      <TableHead></TableHead>
                      <TableHead>{t("changedCol")}</TableHead>
                      <TableHead className="text-right">{t("gloss")}</TableHead>
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
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {changedCount > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{entries.length}</div>
              <div className="text-xs text-muted-foreground">{t("totalWords")}</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-primary">{changedCount}</div>
              <div className="text-xs text-muted-foreground">{t("changedLabel")}</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">
                {Math.round((changedCount / entries.length) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">{t("affected")}</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
