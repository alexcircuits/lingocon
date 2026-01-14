"use client"

import { useState, useEffect, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, ArrowRight, Search, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DictionaryEntry } from "@prisma/client"

interface DerivationWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceEntry: DictionaryEntry | null
    allEntries?: DictionaryEntry[]
    onSubmit: (data: any) => Promise<void>
    isPending?: boolean
}

type DerivationType = "SUFFIX" | "PREFIX" | "COMPOUND"

export function DerivationWizard({
    open,
    onOpenChange,
    sourceEntry,
    allEntries = [],
    onSubmit,
    isPending,
}: DerivationWizardProps) {
    const [type, setType] = useState<DerivationType>("SUFFIX")
    const [affix, setAffix] = useState("")
    const [newGloss, setNewGloss] = useState("")
    const [newPartOfSpeech, setNewPartOfSpeech] = useState("")

    // For compound: second word selection
    const [secondWordId, setSecondWordId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")

    // Get the second entry object
    const secondEntry = useMemo(() => {
        if (!secondWordId) return null
        return allEntries.find(e => e.id === secondWordId) || null
    }, [secondWordId, allEntries])

    // Filter available entries (exclude the source entry)
    const availableEntries = useMemo(() => {
        if (!sourceEntry) return allEntries
        return allEntries.filter(e => e.id !== sourceEntry.id)
    }, [allEntries, sourceEntry])

    // Filter by search query
    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return availableEntries
        const query = searchQuery.toLowerCase()
        return availableEntries.filter(e =>
            e.lemma.toLowerCase().includes(query) ||
            e.gloss.toLowerCase().includes(query)
        )
    }, [availableEntries, searchQuery])

    // Reset state when opening
    useEffect(() => {
        if (open && sourceEntry) {
            setAffix("")
            setNewGloss(`Derived from ${sourceEntry.lemma}`)
            setNewPartOfSpeech(sourceEntry.partOfSpeech || "")
            setSecondWordId(null)
            setSearchQuery("")
        }
    }, [open, sourceEntry])

    // Update gloss when compound second word changes
    useEffect(() => {
        if (type === "COMPOUND" && sourceEntry && secondEntry) {
            setNewGloss(`Compound of ${sourceEntry.lemma} + ${secondEntry.lemma}`)
        } else if (sourceEntry) {
            setNewGloss(`Derived from ${sourceEntry.lemma}`)
        }
    }, [type, sourceEntry, secondEntry])

    const deriveWord = (root: string, affixVal: string, method: DerivationType) => {
        if (!root) return ""
        if (method === "SUFFIX") return root + affixVal
        if (method === "PREFIX") return affixVal + root
        if (method === "COMPOUND") {
            // For compound, use the second word's lemma instead of affix
            if (secondEntry) {
                return root + secondEntry.lemma
            }
            return root + affixVal // Fallback to typed affix if no second word selected
        }
        return root
    }

    const resultLemma = sourceEntry
        ? deriveWord(sourceEntry.lemma, affix, type)
        : ""

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!sourceEntry || !resultLemma) return

        // Build related words array
        const relatedWords: string[] = [sourceEntry.lemma]
        if (type === "COMPOUND" && secondEntry) {
            relatedWords.push(secondEntry.lemma)
        }

        // Build etymology text
        let etymologyText: string
        if (type === "COMPOUND" && secondEntry) {
            etymologyText = `Compound of [${sourceEntry.lemma}] + [${secondEntry.lemma}]`
        } else {
            etymologyText = `Derived from [${sourceEntry.lemma}] using ${type.toLowerCase()} '${affix}'`
        }

        await onSubmit({
            lemma: resultLemma,
            gloss: newGloss,
            partOfSpeech: newPartOfSpeech,
            etymology: etymologyText,
            relatedWords,
        })
    }

    const isCompoundValid = type !== "COMPOUND" || secondEntry !== null
    const canSubmit = resultLemma && isCompoundValid

    const handleSelectSecondWord = (entryId: string) => {
        setSecondWordId(entryId)
        setSearchQuery("")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Derive Word</DialogTitle>
                    <DialogDescription>
                        Create a new word derived from <span className="font-semibold text-foreground">&quot;{sourceEntry?.lemma}&quot;</span>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Derivation Type</Label>
                                <Select
                                    value={type}
                                    onValueChange={(v) => {
                                        setType(v as DerivationType)
                                        if (v !== "COMPOUND") {
                                            setSecondWordId(null)
                                            setSearchQuery("")
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SUFFIX">Suffix (-end)</SelectItem>
                                        <SelectItem value="PREFIX">Prefix (start-)</SelectItem>
                                        <SelectItem value="COMPOUND">Compound (word+word)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {type === "COMPOUND" ? (
                                <div className="space-y-2">
                                    <Label>Second Word</Label>
                                    {secondEntry ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 px-3 py-2 rounded-md border bg-muted/50 font-serif">
                                                {secondEntry.lemma}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSecondWordId(null)}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                Change
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search words..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>
                                            <ScrollArea className="h-[120px] rounded-md border">
                                                <div className="p-1">
                                                    {filteredEntries.length === 0 ? (
                                                        <div className="py-4 text-center text-sm text-muted-foreground">
                                                            No words found
                                                        </div>
                                                    ) : (
                                                        filteredEntries.slice(0, 50).map((entry) => (
                                                            <button
                                                                key={entry.id}
                                                                type="button"
                                                                onClick={() => handleSelectSecondWord(entry.id)}
                                                                className={cn(
                                                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left text-sm",
                                                                    "hover:bg-accent hover:text-accent-foreground",
                                                                    "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                                                                    "transition-colors cursor-pointer"
                                                                )}
                                                            >
                                                                <span className="font-serif">{entry.lemma}</span>
                                                                <span className="text-xs text-muted-foreground truncate flex-1">
                                                                    {entry.gloss}
                                                                </span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Affix / Component</Label>
                                    <Input
                                        placeholder={type === "SUFFIX" ? "-er, -tion" : "un-, re-"}
                                        value={affix}
                                        onChange={(e) => setAffix(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        {/* Preview Section */}
                        <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between gap-4">
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">Source</div>
                                <div className="font-serif text-lg">{sourceEntry?.lemma}</div>
                            </div>
                            {type === "COMPOUND" && (
                                <>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                    <div className="text-center flex-1">
                                        <div className="text-sm text-muted-foreground">Second</div>
                                        <div className="font-serif text-lg">
                                            {secondEntry?.lemma || "..."}
                                        </div>
                                    </div>
                                </>
                            )}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">Result</div>
                                <div className="font-serif text-xl font-medium text-primary">
                                    {resultLemma || "..."}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>New Meaning (Gloss)</Label>
                            <Input
                                value={newGloss}
                                onChange={(e) => setNewGloss(e.target.value)}
                                placeholder="Definition of the new word"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Part of Speech</Label>
                            <Input
                                value={newPartOfSpeech}
                                onChange={(e) => setNewPartOfSpeech(e.target.value)}
                                placeholder="e.g. noun, verb (derived)"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Derived Word
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
