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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Plus, RefreshCw, Copy, Check, Info } from "lucide-react"
import { generateWords, parseSyllableStructure } from "@/lib/utils/word-generator"
import { toast } from "sonner"
import type { ScriptSymbol } from "@prisma/client"

// Same IPA maps from phonology-view (consonants and vowels)
const IPA_CONSONANTS = new Set([
    "p", "b", "t", "d", "ʈ", "ɖ", "c", "ɟ", "k", "g", "ɡ", "q", "ɢ", "ʔ",
    "m", "ɱ", "n", "ɳ", "ɲ", "ŋ", "ɴ",
    "ʙ", "r", "ʀ", "ⱱ", "ɾ", "ɽ",
    "ɸ", "β", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "ʂ", "ʐ", "ç", "ʝ",
    "x", "ɣ", "χ", "ʁ", "ħ", "ʕ", "h", "ɦ",
    "ɬ", "ɮ", "ʋ", "ɹ", "ɻ", "j", "ɰ", "w",
    "l", "ɭ", "ʎ", "ʟ",
    // Affricates
    "ts", "dz", "tʃ", "dʒ", "tɕ", "dʑ", "ʈʂ", "ɖʐ", "pf", "bv", "kx",
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
    metadata: Record<string, any>
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
    const [count, setCount] = useState(20)
    const [minSyllables, setMinSyllables] = useState(1)
    const [maxSyllables, setMaxSyllables] = useState(3)
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
            const ipa = (sym as any).ipa
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

    const handleGenerate = () => {
        if (!hasPhonemes) {
            toast.error("No phonemes found. Add script symbols with IPA values first.")
            return
        }

        const words = generateWords({
            syllableStructure,
            consonants,
            vowels,
            minSyllables,
            maxSyllables,
            count,
            existingWords: new Set(existingLemmas),
        })

        setGeneratedWords(words)
        if (words.length === 0) {
            toast.warning("Could not generate any unique words with these settings. Try adjusting syllable count or structure.")
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
        const label = s.type === "C" ? "consonant" : "vowel"
        return s.optional ? `(${label})` : label
    }).join(" + ")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Word Generator
                    </DialogTitle>
                    <DialogDescription>
                        Generate phonotactically valid words from your language&apos;s phonology.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 flex-1 min-h-0">
                    {/* Phonology info */}
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span>Using your language&apos;s phonology settings</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-xs">
                                Structure: {syllableStructure || "CV"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {consonants.length} consonants
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {vowels.length} vowels
                            </Badge>
                        </div>
                        {templateDesc && (
                            <p className="text-xs text-muted-foreground">
                                Each syllable: {templateDesc}
                            </p>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Min syllables</Label>
                            <Input
                                type="number"
                                min={1}
                                max={6}
                                value={minSyllables}
                                onChange={(e) => setMinSyllables(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max syllables</Label>
                            <Input
                                type="number"
                                min={1}
                                max={6}
                                value={maxSyllables}
                                onChange={(e) => setMaxSyllables(Math.max(minSyllables, Math.min(6, parseInt(e.target.value) || 1)))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Count</Label>
                            <Input
                                type="number"
                                min={1}
                                max={200}
                                value={count}
                                onChange={(e) => setCount(Math.max(1, Math.min(200, parseInt(e.target.value) || 20)))}
                            />
                        </div>
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
                                Regenerate
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                Generate {count} Words
                            </>
                        )}
                    </Button>

                    {/* Results */}
                    {generatedWords.length > 0 && (
                        <ScrollArea className="h-[280px] rounded-lg border">
                            <div className="p-2 grid grid-cols-2 gap-1.5">
                                {generatedWords.map((word, idx) => (
                                    <div
                                        key={`${word}-${idx}`}
                                        className="group flex items-center justify-between gap-1 rounded-md border border-border/50 bg-card px-3 py-2 text-sm hover:border-primary/30 hover:bg-muted/50 transition-colors"
                                    >
                                        <span className="font-mono tracking-wide truncate">{word}</span>
                                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleCopy(word, idx)}
                                                title="Copy"
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
                                                className="h-6 w-6 text-primary"
                                                onClick={() => handleAddWord(word)}
                                                title="Add to dictionary"
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
                            <p className="font-medium mb-1">No phonemes detected</p>
                            <p>Add script symbols with IPA values in the Alphabet tab, or define phonemes manually in the Phonology tab.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
