"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteLanguage } from "@/app/actions/language"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

interface DeleteLanguageCardProps {
  languageId: string
  languageName: string
}

export function DeleteLanguageCard({ languageId, languageName }: DeleteLanguageCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (deleteConfirm !== languageName) {
      setError("Language name does not match")
      return
    }

    startTransition(async () => {
      const result = await deleteLanguage(languageId)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success("Language deleted successfully")
        router.push("/dashboard")
      }
    })
  }

  return (
    <Card className="p-6 border-destructive">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Danger Zone
          </h3>
          <p className="text-sm text-muted-foreground">
            Once you delete a language, there is no going back. Please be certain.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Language
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the
                language and all associated data (alphabet, grammar pages,
                dictionary entries).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-sm">
                To confirm, type the language name{" "}
                <strong>{languageName}</strong> below:
              </p>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={languageName}
                disabled={isPending}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteOpen(false)
                  setDeleteConfirm("")
                  setError(null)
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending || deleteConfirm !== languageName}
              >
                {isPending ? "Deleting..." : "Delete Language"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsDeleteOpen(true)}
          disabled={isPending}
        >
          Delete Language
        </Button>
      </div>
    </Card>
  )
}
