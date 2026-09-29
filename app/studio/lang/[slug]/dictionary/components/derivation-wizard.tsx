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
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { DictionaryEntry } from "@prisma/client"
import { searchLanguageEntries } from "@/app/actions/dictionary-entry"
import { useDebounce } from "@/lib/hooks/use-debounce"

type PickableEntry = { id: string; lemma: string; gloss: string; partOfSpeech: string | null }

interface DerivationWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceEntry: DictionaryEntry | null
    /** Compound partners are searched across the whole language (GitHub #25), not just this page. */
    languageId: string
    onSubmit: (data: any) => Promise<void>
    isPending?: boolean
}

type DerivationType = "SUFFIX" | "PREFIX" | "COMPOUND"

export function DerivationWizard({
    open,
    onOpenChange,
    sourceEntry,
    languageId,
    onSubmit,
    isPending,
}: DerivationWizardProps) {
    const t = useTranslations("derive")
    const [type, setType] = useState<DerivationType>("SUFFIX")
    const [affix, setAffix] = useState("")
    const [newGloss, setNewGloss] = useState("")
    const [newPartOfSpeech, setNewPartOfSpeech] = useState("")

    // For compound: second word selection
    const [secondEntry, setSecondEntry] = useState<PickableEntry | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const debouncedQuery = useDebounce(searchQuery, 250)
    const [searchResults, setSearchResults] = useState<PickableEntry[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        if (!open || type !== "COMPOUND") return
        let cancelled = false
        setIsSearching(true)
        searchLanguageEntries(languageId, debouncedQuery)
            .then((rows) => {
                if (!cancelled) setSearchResults(rows)
            })
            .catch(() => {
                if (!cancelled) setSearchResults([])
            })
            .finally(() => {
                if (!cancelled) setIsSearching(false)
            })
        return () => {
            cancelled = true
        }
    }, [open, type, languageId, debouncedQuery])

    // Exclude the source entry itself
    const filteredEntries = useMemo(
        () => searchResults.filter((e) => e.id !== sourceEntry?.id),
        [searchResults, sourceEntry]
    )
    const secondWordId = secondEntry?.id ?? null

    // Reset state when opening
    useEffect(() => {
        if (open && sourceEntry) {
            setAffix("")
            setNewGloss(t("glossDerivedFrom", { lemma: sourceEntry.lemma }))
            setNewPartOfSpeech(sourceEntry.partOfSpeech || "")
            setSecondEntry(null)
            setSearchQuery("")
        }
    }, [open, sourceEntry])

    // Update gloss when compound second word changes
    useEffect(() => {
        if (type === "COMPOUND" && sourceEntry && secondEntry) {
            setNewGloss(t("glossCompoundOf", { a: sourceEntry.lemma, b: secondEntry.lemma }))
        } else if (sourceEntry) {
            setNewGloss(t("glossDerivedFrom", { lemma: sourceEntry.lemma }))
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
            etymologyText = t("etymCompound", { a: sourceEntry.lemma, b: secondEntry.lemma })
        } else {
            etymologyText = t("etymDerived", {
                lemma: sourceEntry.lemma,
                method: type === "SUFFIX" ? t("methodSuffix") : t("methodPrefix"),
                affix,
            })
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

    const handleSelectSecondWord = (entry: PickableEntry) => {
        setSecondEntry(entry)
        setSearchQuery("")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t("title")}</DialogTitle>
                    <DialogDescription>
                        {t("desc", { lemma: sourceEntry?.lemma ?? "" })}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("derivationType")}</Label>
                                <Select
                                    value={type}
                                    onValueChange={(v) => {
                                        setType(v as DerivationType)
                                        if (v !== "COMPOUND") {
                                            setSecondEntry(null)
                                            setSearchQuery("")
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SUFFIX">{t("typeSuffix")}</SelectItem>
                                        <SelectItem value="PREFIX">{t("typePrefix")}</SelectItem>
                                        <SelectItem value="COMPOUND">{t("typeCompound")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {type === "COMPOUND" ? (
                                <div className="space-y-2">
                                    <Label>{t("secondWord")}</Label>
                                    {secondEntry ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 px-3 py-2 rounded-md border bg-muted/50 font-serif">
                                                {secondEntry.lemma}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSecondEntry(null)}
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
                                                    placeholder={t("searchWordsPh")}
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>
                                            <ScrollArea className="h-[120px] rounded-md border">
                                                <div className="p-1">
                                                    {isSearching && filteredEntries.length === 0 ? (
                                                        <div className="flex justify-center py-4" role="status">
                                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                                                        </div>
                                                    ) : filteredEntries.length === 0 ? (
                                                        <div className="py-4 text-center text-sm text-muted-foreground">
                                                            {t("noWordsFound")}
                                                        </div>
                                                    ) : (
                                                        filteredEntries.map((entry) => (
                                                            <button
                                                                key={entry.id}
                                                                type="button"
                                                                onClick={() => handleSelectSecondWord(entry)}
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
                                    <Label>{t("affixComponent")}</Label>
                                    <Input
                                        placeholder={type === "SUFFIX" ? t("affixSuffixPh") : t("affixPrefixPh")}
                                        value={affix}
                                        onChange={(e) => setAffix(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        {/* Preview Section */}
                        <div className="rounded-lg border bg-muted/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">{t("source")}</div>
                                <div className="font-serif text-lg">{sourceEntry?.lemma}</div>
                            </div>
                            {type === "COMPOUND" && (
                                <>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                    <div className="text-center flex-1">
                                        <div className="text-sm text-muted-foreground">{t("second")}</div>
                                        <div className="font-serif text-lg">
                                            {secondEntry?.lemma || "..."}
                                        </div>
                                    </div>
                                </>
                            )}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">{t("result")}</div>
                                <div className="font-serif text-xl font-medium text-primary">
                                    {resultLemma || "..."}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t("newMeaning")}</Label>
                            <Input
                                value={newGloss}
                                onChange={(e) => setNewGloss(e.target.value)}
                                placeholder={t("newMeaningPh")}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t("partOfSpeech")}</Label>
                            <Input
                                value={newPartOfSpeech}
                                onChange={(e) => setNewPartOfSpeech(e.target.value)}
                                placeholder={t("posPh")}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("cancel")}
                        </Button>
                        <Button type="submit" disabled={!canSubmit || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("createDerived")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
