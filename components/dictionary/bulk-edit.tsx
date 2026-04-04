"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { bulkUpdateDictionaryEntries } from "@/app/actions/dictionary-entry"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface BulkEditProps {
  entryIds: string[]
  languageId: string
  onClose: () => void
}

export function BulkEdit({ entryIds, languageId, onClose }: BulkEditProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [updates, setUpdates] = useState({
    partOfSpeech: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Only include fields that have values
    const updateData: { partOfSpeech?: string; notes?: string } = {}
    if (updates.partOfSpeech.trim()) {
      updateData.partOfSpeech = updates.partOfSpeech.trim()
    }
    if (updates.notes.trim()) {
      updateData.notes = updates.notes.trim()
    }

    if (Object.keys(updateData).length === 0) {
      toast.error("Please fill in at least one field to update")
      return
    }

    startTransition(async () => {
      const result = await bulkUpdateDictionaryEntries(
        entryIds,
        updateData,
        languageId
      )

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Updated ${result.updatedCount} entries`)
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Bulk Edit {entryIds.length} Entries</DialogTitle>
            <DialogDescription>
              Update common fields for selected entries. Leave fields empty to keep
              existing values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-pos">Part of Speech</Label>
              <Input
                id="bulk-pos"
                value={updates.partOfSpeech}
                onChange={(e) =>
                  setUpdates({ ...updates, partOfSpeech: e.target.value })
                }
                placeholder="Leave empty to keep existing values"
                disabled={isPending}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Will update part of speech for all selected entries
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-notes">Notes</Label>
              <Textarea
                id="bulk-notes"
                value={updates.notes}
                onChange={(e) =>
                  setUpdates({ ...updates, notes: e.target.value })
                }
                placeholder="Leave empty to keep existing values"
                disabled={isPending}
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Will update notes for all selected entries
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                `Update ${entryIds.length} Entries`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

