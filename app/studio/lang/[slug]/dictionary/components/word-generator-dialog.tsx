"use client"

import { useState, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Plus, RefreshCw, Copy, Check, Info } from "lucide-react"
import { generateWords, parseSyllableStructure, buildPhonemeWeights } from "@/lib/utils/word-generator"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { ScriptSymbol } from "@prisma/client"
import type { LanguageMetadata } from "@/lib/validations/language"

// Same IPA maps from phonology-view (consonants and vowels)
const IPA_CONSONANTS = new Set([
    "p", "b", "t", "d", "ʈ", "ɖ", "c", "ɟ", "k", "g", "ɡ", "q", "ɢ", "ʔ",
    "m", "ɱ", "n", "ɳ", "ɲ", "ŋ", "ɴ",
    "ʙ", "r", "ʀ", "ⱱ", "ɾ", "ɽ", "ɺ",
    "ɸ", "β", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "ʂ", "ʐ", "ç", "ʝ", "ɕ", "ʑ",
    "x", "ɣ", "χ", "ʁ", "ħ", "ʕ", "h", "ɦ", "ɼ",
    "ɬ", "ɮ", "ʋ", "ɹ", "ɻ", "j", "ɰ", "w",
    "l", "ɫ", "ɭ", "ʎ", "ʟ",
    // Affricates
    "ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "ʈʂ", "ɖʐ", "pf", "bv", "kx", "gɣ", "ɡɣ",
])

const IPA_VOWELS = new Set([
    "i", "y", "ɨ", "ʉ", "ɯ", "u",
    "ɪ", "ʏ", "ʊ",
    "e", "ø", "ɘ", "ɵ", "ɤ", "o",
    "ə",
    "ɛ", "œ", "ɜ", "ɞ", "ʌ", "ɔ",
    "æ", "ɐ",
    "a", "ɶ", "ɑ", "ɒ",
])

// Greedy IPA parser (longest match first)
const ALL_IPA_SORTED = [
    ...Array.from(IPA_CONSONANTS),
    ...Array.from(IPA_VOWELS),
].sort((a, b) => b.length - a.length)

function classifyIPA(ipaStr: string): { consonants: string[]; vowels: string[] } {
    const consonants: string[] = []
    const vowels: string[] = []
    const seen = new Set<string>()

    // Parse each symbol's IPA field with greedy matching
    let remaining = ipaStr
    while (remaining.length > 0) {
        let matched = false
        for (const ipa of ALL_IPA_SORTED) {
            if (remaining.startsWith(ipa)) {
                if (!seen.has(ipa)) {
                    seen.add(ipa)
                    if (IPA_CONSONANTS.has(ipa)) consonants.push(ipa)
                    else if (IPA_VOWELS.has(ipa)) vowels.push(ipa)
                }
                remaining = remaining.slice(ipa.length)
                matched = true
                break
            }
        }
        if (!matched) {
            remaining = remaining.slice(1) // skip unknown char
        }
    }

    return { consonants, vowels }
}

interface WordGeneratorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    symbols: ScriptSymbol[]
    metadata: LanguageMetadata
    existingLemmas: string[]
    onAddWord: (word: string) => void
}

export function WordGeneratorDialog({
    open,
    onOpenChange,
    symbols,
    metadata,
    existingLemmas,
    onAddWord,
}: WordGeneratorDialogProps) {
    const t = useTranslations("wordGen")
    const tPhon = useTranslations("studio.phonology")
    const [count, setCount] = useState(20)
    const [minSyllables, setMinSyllables] = useState(1)
    const [maxSyllables, setMaxSyllables] = useState(3)
    const [rejectPatternsInput, setRejectPatternsInput] = useState("")
    const [generatedWords, setGeneratedWords] = useState<string[]>([])
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

    // Extract consonants and vowels from the language's phonology
    const { consonants, vowels } = useMemo(() => {
        const override = metadata?.phonologyOverride
        if (override?.enabled && (override.consonants?.length || override.vowels?.length)) {
            return {
                consonants: override.consonants || [],
                vowels: override.vowels || [],
            }
        }

        // Auto-detect from script symbols IPA
        const allC: string[] = []
        const allV: string[] = []
        const seenC = new Set<string>()
        const seenV = new Set<string>()

        for (const sym of symbols) {
            const ipa = sym.ipa
            if (!ipa) continue
            const classified = classifyIPA(ipa)
            for (const c of classified.consonants) {
                if (!seenC.has(c)) { seenC.add(c); allC.push(c) }
            }
            for (const v of classified.vowels) {
                if (!seenV.has(v)) { seenV.add(v); allV.push(v) }
            }
        }

        return { consonants: allC, vowels: allV }
    }, [symbols, metadata])

    const syllableStructure = metadata?.syllableStructure || "CV"

    const slots = useMemo(() => parseSyllableStructure(syllableStructure), [syllableStructure])
    const hasPhonemes = consonants.length > 0 || vowels.length > 0

    // Build phoneme frequency weights from the existing lexicon so generated words
    // reflect the language's natural phoneme distribution.
    const phonemeWeights = useMemo(
        () => buildPhonemeWeights(existingLemmas, [...consonants, ...vowels]),
        [existingLemmas, consonants, vowels]
    )

    const handleGenerate = () => {
        if (!hasPhonemes) {
            toast.error(t("toastNoPhonemes"))
            return
        }

        const rejectPatterns = rejectPatternsInput
            .split(/[\n,]/)
            .map(p => p.trim())
            .filter(Boolean)

        const words = generateWords({
            syllableStructure,
            consonants,
            vowels,
            minSyllables,
            maxSyllables,
            count,
            existingWords: new Set(existingLemmas),
            phonemeWeights: existingLemmas.length >= 10 ? phonemeWeights : undefined,
            rejectPatterns,
        })

        setGeneratedWords(words)
        if (words.length === 0) {
            toast.warning(t("toastNoWords"))
        }
    }

    const handleCopy = (word: string, idx: number) => {
        navigator.clipboard.writeText(word)
        setCopiedIdx(idx)
        setTimeout(() => setCopiedIdx(null), 1500)
    }

    const handleAddWord = (word: string) => {
        onAddWord(word)
        onOpenChange(false)
    }

    // Build a human-readable template description
    const templateDesc = slots.map(s => {
        const label = s.type === "C" ? t("slotConsonant") : t("slotVowel")
        return s.optional ? `(${label})` : label
    }).join(" + ")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t("title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("desc")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 flex-1 min-h-0">
                    {/* Phonology info */}
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span>{t("usingPhonology")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-xs">
                                {t("structure", { value: syllableStructure || "CV" })}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {tPhon("consonants", { count: consonants.length })}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {tPhon("vowels", { count: vowels.length })}
                            </Badge>
                        </div>
                        {templateDesc && (
                            <p className="text-xs text-muted-foreground">
                                {t("eachSyllable", { template: templateDesc })}
                            </p>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("minSyllables")}</Label>
                            <Input
                                type="number"
                                min={1}
                                max={6}
                                value={minSyllables}
                                onChange={(e) => setMinSyllables(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("maxSyllables")}</Label>
                            <Input
                                type="number"
                                min={1}
                                max={6}
                                value={maxSyllables}
                                onChange={(e) => setMaxSyllables(Math.max(minSyllables, Math.min(6, parseInt(e.target.value) || 1)))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t("count")}</Label>
                            <Input
                                type="number"
                                min={1}
                                max={200}
                                value={count}
                                onChange={(e) => setCount(Math.max(1, Math.min(200, parseInt(e.target.value) || 20)))}
                            />
                        </div>
                    </div>

                    {/* Forbidden sequences */}
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t("rejectPatterns")}</Label>
                        <Textarea
                            className="min-h-[60px] text-sm"
                            placeholder={t("rejectPatternsPlaceholder")}
                            value={rejectPatternsInput}
                            onChange={(e) => setRejectPatternsInput(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">{t("rejectPatternsHelp")}</p>
                    </div>

                    {/* Generate button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={!hasPhonemes}
                        className="w-full gap-2"
                    >
                        {generatedWords.length > 0 ? (
                            <>
                                <RefreshCw className="h-4 w-4" />
                                {t("regenerate")}
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                {t("generateN", { count })}
                            </>
                        )}
                    </Button>

                    {/* Results */}
                    {generatedWords.length > 0 && (
                        <ScrollArea className="h-[280px] rounded-lg border">
                            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {generatedWords.map((word, idx) => (
                                    <div
                                        key={`${word}-${idx}`}
                                        className="group flex items-center justify-between gap-1 rounded-md border border-border/50 bg-card px-3 py-2 text-sm hover:border-primary/30 hover:bg-muted/50 transition-colors"
                                    >
                                        <span className="font-mono tracking-wide truncate">{word}</span>
                                        <div className="flex items-center gap-0.5 shrink-0 hover-reveal">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 sm:h-8 sm:w-8"
                                                onClick={() => handleCopy(word, idx)}
                                                title={t("copy")}
                                            >
                                                {copiedIdx === idx ? (
                                                    <Check className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 sm:h-8 sm:w-8 text-primary"
                                                onClick={() => handleAddWord(word)}
                                                title={t("addToDict")}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    {!hasPhonemes && (
                        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                            <p className="font-medium mb-1">{t("noPhonemesTitle")}</p>
                            <p>{t("noPhonemesDesc")}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
