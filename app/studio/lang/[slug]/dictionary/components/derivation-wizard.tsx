"use client"

import { useState, useEffect } from "react"
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
import { Loader2, ArrowRight } from "lucide-react"
import type { DictionaryEntry } from "@prisma/client"

interface DerivationWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceEntry: DictionaryEntry | null
    onSubmit: (data: any) => Promise<void>
    isPending?: boolean
}

type DerivationType = "SUFFIX" | "PREFIX" | "COMPOUND"

export function DerivationWizard({
    open,
    onOpenChange,
    sourceEntry,
    onSubmit,
    isPending,
}: DerivationWizardProps) {
    const [type, setType] = useState<DerivationType>("SUFFIX")
    const [affix, setAffix] = useState("")
    const [newGloss, setNewGloss] = useState("")
    const [newPartOfSpeech, setNewPartOfSpeech] = useState("")

    // Reset state when opening
    useEffect(() => {
        if (open && sourceEntry) {
            setAffix("")
            setNewGloss(`Derived from ${sourceEntry.lemma}`)
            setNewPartOfSpeech(sourceEntry.partOfSpeech || "")
        }
    }, [open, sourceEntry])

    const deriveWord = (root: string, affixVal: string, method: DerivationType) => {
        if (!root) return ""
        if (method === "SUFFIX") return root + affixVal
        if (method === "PREFIX") return affixVal + root
        if (method === "COMPOUND") return root + affixVal // Simplified for now
        return root
    }

    const resultLemma = sourceEntry ? deriveWord(sourceEntry.lemma, affix, type) : ""

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!sourceEntry || !resultLemma) return

        await onSubmit({
            lemma: resultLemma,
            gloss: newGloss,
            partOfSpeech: newPartOfSpeech,
            etymology: `Derived from [${sourceEntry.lemma}] using ${type.toLowerCase()} '${affix}'`,
            relatedWords: [sourceEntry.lemma], // We'll handle ID resolution in the parent or server action if needed, but simple string relation is good for display
            // Ideally we pass sourceEntry.id, but the current UI displays string relatedWords. 
            // Let's rely on the manager to handle relatedWords correctly if they are IDs.
            // Based on schema, relatedWords is Json? but manager treats it as strings in the table. 
            // Let's pass the ID if we can, or just the lemma. The table code showed `entry.relatedWords as string[]`.
        })
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
                                    onValueChange={(v) => setType(v as DerivationType)}
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
                            <div className="space-y-2">
                                <Label>Affix / Component</Label>
                                <Input
                                    placeholder={type === "SUFFIX" ? "-er, -tion" : "un-, re-"}
                                    value={affix}
                                    onChange={(e) => setAffix(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Preview Section */}
                        <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between gap-4">
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">Source</div>
                                <div className="font-serif text-lg">{sourceEntry?.lemma}</div>
                            </div>
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
                        <Button type="submit" disabled={!resultLemma || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Derived Word
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
