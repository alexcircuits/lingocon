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
}

export function DictionaryEntryDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isPending,
  mode,
  symbols,
}: DictionaryEntryDialogProps) {
  const [formData, setFormData] = useState({
    lemma: "",
    gloss: "",
    ipa: "",
    partOfSpeech: "",
    etymology: "",
    relatedWords: [] as string[],
    notes: "",
  })

  const { errors, touched, handleBlur, handleChange, validateForm } = useFormValidation(
    formData,
    {
      lemma: [
        commonRules.required("Lemma is required"),
        commonRules.maxLength(200),
        {
          validator: (value) => {
            if (!symbols || symbols.length === 0) return true
            const invalidChars = validateStringAgainstAlphabet(value, symbols)
            return invalidChars.length === 0
          },
          message: "Contains characters not in your alphabet"
        }
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
                  errors.lemma && touched.lemma && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {errors.lemma && touched.lemma && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{errors.lemma}</span>
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
