"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Plus,
    Trash2,
    Edit2,
    X,
    Check,
    MessageSquareQuote
} from "lucide-react"
import { toast } from "sonner"
import {
    createExampleSentence,
    updateExampleSentence,
    deleteExampleSentence,
} from "@/app/actions/example-sentence"
import type { ExampleSentence } from "@prisma/client"

interface ExampleSentencesProps {
    examples: ExampleSentence[]
    dictionaryEntryId: string
    languageId: string
    canEdit?: boolean
}

export function ExampleSentences({
    examples,
    dictionaryEntryId,
    languageId,
    canEdit = false,
}: ExampleSentencesProps) {
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    // Form state
    const [sentence, setSentence] = useState("")
    const [gloss, setGloss] = useState("")
    const [translation, setTranslation] = useState("")

    const resetForm = () => {
        setSentence("")
        setGloss("")
        setTranslation("")
        setIsAdding(false)
        setEditingId(null)
    }

    const handleCreate = () => {
        if (!sentence.trim() || !translation.trim()) {
            toast.error("Sentence and translation are required")
            return
        }

        startTransition(async () => {
            const result = await createExampleSentence({
                sentence: sentence.trim(),
                gloss: gloss.trim() || undefined,
                translation: translation.trim(),
                dictionaryEntryId,
                languageId,
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Example added")
                resetForm()
            }
        })
    }

    const handleUpdate = (id: string) => {
        if (!sentence.trim() || !translation.trim()) {
            toast.error("Sentence and translation are required")
            return
        }

        startTransition(async () => {
            const result = await updateExampleSentence({
                id,
                sentence: sentence.trim(),
                gloss: gloss.trim() || undefined,
                translation: translation.trim(),
                dictionaryEntryId,
                languageId,
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Example updated")
                resetForm()
            }
        })
    }

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const result = await deleteExampleSentence(id, languageId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Example deleted")
            }
        })
    }

    const startEdit = (example: ExampleSentence) => {
        setEditingId(example.id)
        setSentence(example.sentence)
        setGloss(example.gloss || "")
        setTranslation(example.translation)
        setIsAdding(false)
    }

    // Render interlinear glossed text
    const renderIGT = (example: ExampleSentence) => {
        const words = example.sentence.split(/\s+/)
        const glossWords = example.gloss ? example.gloss.split(/\s+/) : []

        return (
            <div className="space-y-1">
                {/* Interlinear display */}
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {words.map((word, i) => (
                        <div key={i} className="flex flex-col items-start">
                            <span className="font-custom-script text-base font-medium">{word}</span>
                            {glossWords[i] && (
                                <span className="text-xs text-muted-foreground">{glossWords[i]}</span>
                            )}
                        </div>
                    ))}
                </div>
                {/* Free translation */}
                <p className="text-sm italic text-foreground/70 mt-1">
                    &ldquo;{example.translation}&rdquo;
                </p>
            </div>
        )
    }

    // Form component for creating/editing
    const renderForm = (submitFn: () => void, submitLabel: string) => (
        <div className="space-y-3 p-3 rounded-lg border border-border/60 bg-muted/20">
            <div className="space-y-1.5">
                <Label className="text-xs">Sentence (in your language) *</Label>
                <Input
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    placeholder="Kal na'vi kllte lu"
                    className="font-custom-script"
                    disabled={isPending}
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Gloss (word-by-word)</Label>
                <Input
                    value={gloss}
                    onChange={(e) => setGloss(e.target.value)}
                    placeholder="person Na'vi earth be"
                    className="font-mono text-xs"
                    disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                    Space-separated morpheme glosses, aligned with each word above
                </p>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">Translation *</Label>
                <Input
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    placeholder="The Na'vi person is on Earth"
                    disabled={isPending}
                />
            </div>
            <div className="flex gap-2 justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={isPending}
                >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={submitFn}
                    disabled={isPending}
                >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {isPending ? "Saving..." : submitLabel}
                </Button>
            </div>
        </div>
    )

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4" />
                    Examples
                    {examples.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                            {examples.length}
                        </span>
                    )}
                </h4>
                {canEdit && !isAdding && !editingId && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                            resetForm()
                            setIsAdding(true)
                        }}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Example
                    </Button>
                )}
            </div>

            {/* Existing examples */}
            {examples.length > 0 && (
                <div className="space-y-3">
                    {examples.map((example) => (
                        <div key={example.id} className="group relative">
                            {editingId === example.id ? (
                                renderForm(() => handleUpdate(example.id), "Update")
                            ) : (
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                                    {renderIGT(example)}
                                    {canEdit && (
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => startEdit(example)}
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 hover:text-destructive"
                                                onClick={() => handleDelete(example.id)}
                                                disabled={isPending}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state for public */}
            {examples.length === 0 && !canEdit && (
                <p className="text-xs text-muted-foreground italic">No examples yet</p>
            )}

            {/* Add form */}
            {isAdding && renderForm(handleCreate, "Add")}
        </div>
    )
}
