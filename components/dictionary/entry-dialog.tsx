"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createDictionaryEntry,
  updateDictionaryEntry,
} from "@/app/actions/dictionary-entry"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IPAInput } from "@/components/ui/ipa-input"
import { Label } from "@/components/ui/label"
import { TagsInput } from "@/components/ui/tags-input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DictionaryEntry } from "@prisma/client"

interface EntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  languageId: string
  entryToEdit?: DictionaryEntry | null
  onSuccess?: () => void
}

export function EntryDialog({
  open,
  onOpenChange,
  languageId,
  entryToEdit,
  onSuccess,
}: EntryDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  // Reset form when opening/closing or switching entries
  useEffect(() => {
    if (open) {
      if (entryToEdit) {
        setFormData({
          lemma: entryToEdit.lemma,
          gloss: entryToEdit.gloss,
          ipa: entryToEdit.ipa || "",
          partOfSpeech: entryToEdit.partOfSpeech || "",
          etymology: entryToEdit.etymology || "",
          relatedWords: Array.isArray(entryToEdit.relatedWords)
            ? (entryToEdit.relatedWords as string[])
            : [],
          notes: entryToEdit.notes || "",
          tags: Array.isArray(entryToEdit.tags)
            ? (entryToEdit.tags as string[])
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
      setError(null)
    }
  }, [open, entryToEdit])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      let result

      if (entryToEdit) {
        result = await updateDictionaryEntry({
          id: entryToEdit.id,
          ...formData,
          relatedWords: formData.relatedWords.length > 0 ? formData.relatedWords : undefined,
          tags: formData.tags.length > 0 ? formData.tags : undefined,
          languageId,
        })
      } else {
        result = await createDictionaryEntry({
          ...formData,
          relatedWords: formData.relatedWords.length > 0 ? formData.relatedWords : undefined,
          tags: formData.tags.length > 0 ? formData.tags : undefined,
          languageId,
        })
      }

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(
          entryToEdit
            ? "Entry updated successfully"
            : "Entry created successfully"
        )
        onOpenChange(false)
        router.refresh()
        onSuccess?.()
      }
    })
  }

  const isEditing = !!entryToEdit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Dictionary Entry" : "Add Dictionary Entry"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details for this vocabulary entry."
                : "Add a new word to your lexicon."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mt-4">
              {error}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lemma">Lemma *</Label>
                <Input
                  id="lemma"
                  value={formData.lemma}
                  onChange={(e) =>
                    setFormData({ ...formData, lemma: e.target.value })
                  }
                  placeholder="word"
                  required
                  disabled={isPending}
                  maxLength={200}
                  className="input-focus"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gloss">Gloss *</Label>
                <Input
                  id="gloss"
                  value={formData.gloss}
                  onChange={(e) =>
                    setFormData({ ...formData, gloss: e.target.value })
                  }
                  placeholder="translation"
                  required
                  disabled={isPending}
                  maxLength={500}
                  className="input-focus"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ipa">IPA</Label>
                <IPAInput
                  id="ipa"
                  value={formData.ipa}
                  onChange={(value) =>
                    setFormData({ ...formData, ipa: value })
                  }
                  placeholder="/wɜrd/"
                  disabled={isPending}
                  maxLength={100}
                  className="input-focus"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pos">Part of Speech</Label>
                <Input
                  id="pos"
                  value={formData.partOfSpeech}
                  onChange={(e) =>
                    setFormData({ ...formData, partOfSpeech: e.target.value })
                  }
                  placeholder="noun, verb, adj..."
                  disabled={isPending}
                  maxLength={50}
                  className="input-focus"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="etymology">Etymology</Label>
              <Textarea
                id="etymology"
                value={formData.etymology}
                onChange={(e) =>
                  setFormData({ ...formData, etymology: e.target.value })
                }
                placeholder="Word origin, history, or derivation..."
                disabled={isPending}
                rows={2}
                maxLength={1000}
                className="input-focus resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Usage notes, examples, or additional context..."
                disabled={isPending}
                rows={3}
                maxLength={2000}
                className="input-focus resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <TagsInput
                value={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
                placeholder="Add tags (e.g. archaic, formal)..."
                maxTags={10}
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
            <Button type="submit" disabled={isPending} className="glow-primary">
              {isPending
                ? isEditing
                  ? "Updating..."
                  : "Adding..."
                : isEditing
                  ? "Update Entry"
                  : "Add Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

