"use client"

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
import { IPAInput } from "@/components/ui/ipa-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useFormValidation, commonRules } from "@/lib/hooks/use-form-validation"
import { AlertCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextualHelp } from "@/components/contextual-help"
import { StatusIndicator } from "@/components/status-indicator"
import { useAutoSave } from "@/lib/hooks/use-auto-save"
import { validateStringAgainstAlphabet } from "@/lib/utils/alphabet-validation"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"

interface DictionaryEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => Promise<void>
  initialData?: DictionaryEntry | null
  isPending?: boolean
  mode: "create" | "edit"
  symbols: ScriptSymbol[]
  allowsDiacritics?: boolean
}

export function DictionaryEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isPending,
  mode,
  symbols,
  allowsDiacritics = false,
}: DictionaryEntryDialogProps) {
  const [formData, setFormData] = useState({
    lemma: "",
    gloss: "",
    ipa: "",
    partOfSpeech: "",
    etymology: "",
    relatedWords: [] as string[],
    notes: "",
    tags: [] as string[],
  })

  // Calculate alphabet warnings (non-blocking validation)
  const alphabetWarnings =
    formData.lemma && symbols && symbols.length > 0
      ? validateStringAgainstAlphabet(formData.lemma, symbols, { allowsDiacritics })
      : []

  const { errors, touched, handleBlur, handleChange, validateForm } = useFormValidation(
    formData,
    {
      lemma: [
        commonRules.required("Lemma is required"),
        commonRules.maxLength(200),
      ],
      gloss: [commonRules.required("Gloss is required"), commonRules.maxLength(500)],
      ipa: [commonRules.maxLength(100)],
      partOfSpeech: [commonRules.maxLength(50)],
      etymology: [commonRules.maxLength(1000)],
      notes: [commonRules.maxLength(2000)],
    }
  )

  useEffect(() => {
    if (initialData) {
      setFormData({
        lemma: initialData.lemma,
        gloss: initialData.gloss,
        ipa: initialData.ipa || "",
        partOfSpeech: initialData.partOfSpeech || "",
        etymology: initialData.etymology || "",
        relatedWords: Array.isArray(initialData.relatedWords)
          ? (initialData.relatedWords as string[])
          : [],
        notes: initialData.notes || "",
        tags: Array.isArray(initialData.tags)
          ? (initialData.tags as string[])
          : [],
      })
    } else {
      setFormData({
        lemma: "",
        gloss: "",
        ipa: "",
        partOfSpeech: "",
        etymology: "",
        relatedWords: [],
        notes: "",
        tags: [],
      })
    }
  }, [initialData, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm(formData)) {
      await onSubmit(formData)
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    handleChange(field, value, formData)
  }

  const suggestIpa = () => {
    if (!formData.lemma || !symbols || symbols.length === 0) return

    // Create a map of native symbols to IPA
    const ipaMap = new Map<string, string>()
    symbols.forEach((s) => {
      if (s.symbol && s.ipa) {
        ipaMap.set(s.symbol, s.ipa)
        if (s.capitalSymbol) {
          ipaMap.set(s.capitalSymbol, s.ipa)
        }
      }
    })

    // Transliterate character by character, keeping unrecognized chars as is
    const suggested = formData.lemma
      .split("")
      .map((char) => ipaMap.get(char) || char)
      .join("")

    handleFieldChange("ipa", suggested)
    toast.success("IPA suggested based on alphabet")
  }

  const [relatedInput, setRelatedInput] = useState("")

  const handleAddRelated = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const word = relatedInput.trim().replace(/,$/, "")
      if (word && !formData.relatedWords.includes(word)) {
        setFormData((prev) => ({
          ...prev,
          relatedWords: [...prev.relatedWords, word],
        }))
        setRelatedInput("")
      }
    }
  }

  const removeRelated = (word: string) => {
    setFormData((prev) => ({
      ...prev,
      relatedWords: prev.relatedWords.filter((w) => w !== word),
    }))
  }

  // Tags handling
  const [tagInput, setTagInput] = useState("")
  const SUGGESTED_TAGS = [
    "body", "food", "animal", "color", "number", "kinship",
    "nature", "emotion", "time", "weather", "tool", "clothing",
  ]

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase().replace(/,$/, "")
      if (tag && !formData.tags.includes(tag)) {
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, tag],
        }))
        setTagInput("")
      }
    }
  }

  const addTag = (tag: string) => {
    if (!formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
    }
  }

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  {mode === "create" ? "Add Dictionary Entry" : "Edit Dictionary Entry"}
                </DialogTitle>
                <DialogDescription>
                  {mode === "create"
                    ? "Add a new entry to the dictionary"
                    : "Update the dictionary entry details"}
                </DialogDescription>
              </div>
              <ContextualHelp
                content="Required fields are marked with *. Use Enter to save, Esc to cancel."
                shortcut="Enter / Esc"
              />
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lemma">Lemma *</Label>
              <Input
                id="lemma"
                value={formData.lemma}
                onChange={(e) => handleFieldChange("lemma", e.target.value)}
                onBlur={() => handleBlur("lemma")}
                placeholder="word"
                required
                disabled={isPending}
                maxLength={200}
                className={cn(
                  "font-custom-script",
                  errors.lemma && touched.lemma && "border-destructive focus-visible:ring-destructive",
                  !errors.lemma && alphabetWarnings.length > 0 && "border-yellow-500 focus-visible:ring-yellow-500"
                )}
              />
              {errors.lemma && touched.lemma && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{errors.lemma}</span>
                </div>
              )}
              {!errors.lemma && alphabetWarnings.length > 0 && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Contains characters not in your alphabet:{" "}
                      <span className="font-mono font-medium">
                        {alphabetWarnings.join(", ")}
                      </span>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs hover:bg-yellow-500/20 hover:text-yellow-700 dark:hover:text-yellow-300"
                    onClick={() => {
                      toast.success("Thanks for the feedback! We'll look into it.")
                    }}
                  >
                    Report
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gloss">Gloss *</Label>
              <Textarea
                id="gloss"
                value={formData.gloss}
                onChange={(e) => handleFieldChange("gloss", e.target.value)}
                onBlur={() => handleBlur("gloss")}
                placeholder="translation"
                required
                disabled={isPending}
                rows={2}
                maxLength={500}
                className={cn(
                  "min-h-[80px]",
                  errors.gloss && touched.gloss && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {errors.gloss && touched.gloss && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{errors.gloss}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ipa">IPA</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary"
                    onClick={suggestIpa}
                    disabled={!formData.lemma || !symbols || symbols.length === 0}
                  >
                    <Sparkles className="h-3 w-3" />
                    Suggest
                  </Button>
                </div>
                <IPAInput
                  id="ipa"
                  value={formData.ipa}
                  onChange={(value) => handleFieldChange("ipa", value)}
                  onBlur={() => handleBlur("ipa")}
                  placeholder="/wɜrd/"
                  disabled={isPending}
                  maxLength={100}
                  className={cn(
                    errors.ipa && touched.ipa && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pos">Part of Speech</Label>
                <Input
                  id="pos"
                  value={formData.partOfSpeech}
                  onChange={(e) => handleFieldChange("partOfSpeech", e.target.value)}
                  onBlur={() => handleBlur("pos")}
                  placeholder="noun, verb, adj..."
                  disabled={isPending}
                  maxLength={50}
                  className={cn(
                    errors.partOfSpeech && touched.partOfSpeech && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="etymology">Etymology</Label>
              <Textarea
                id="etymology"
                value={formData.etymology}
                onChange={(e) => handleFieldChange("etymology", e.target.value)}
                onBlur={() => handleBlur("etymology")}
                placeholder="Word origin or etymology..."
                disabled={isPending}
                rows={2}
                maxLength={1000}
                className={cn(
                  errors.etymology && touched.etymology && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="related">Related Words</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.relatedWords.map((word) => (
                  <div
                    key={word}
                    className="flex items-center gap-1 bg-primary/10 text-primary-foreground px-2 py-1 rounded-md text-sm border border-primary/20"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => removeRelated(word)}
                      className="hover:text-destructive transition-colors"
                    >
                      <AlertCircle className="h-3 w-3 rotate-45" />
                    </button>
                  </div>
                ))}
              </div>
              <Input
                id="related"
                value={relatedInput}
                onChange={(e) => setRelatedInput(e.target.value)}
                onKeyDown={handleAddRelated}
                placeholder="Type word and press Enter or comma..."
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Link related words, antonyms, or synonyms.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                onBlur={() => handleBlur("notes")}
                placeholder="Additional notes..."
                disabled={isPending}
                rows={3}
                maxLength={2000}
                className={cn(
                  errors.notes && touched.notes && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.tags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full text-xs border"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive transition-colors"
                    >
                      <AlertCircle className="h-3 w-3 rotate-45" />
                    </button>
                  </div>
                ))}
              </div>
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type tag and press Enter..."
                disabled={isPending}
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {SUGGESTED_TAGS.filter(t => !formData.tags.includes(t)).slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? mode === "create"
                  ? "Adding..."
                  : "Updating..."
                : mode === "create"
                  ? "Add Entry"
                  : "Update Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
