"use client"

import { useEffect, useState } from "react"
import { getParadigmsForLanguage } from "@/app/actions/paradigm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ParadigmInsertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  languageId: string
  onSelect: (paradigmId: string, paradigmName: string) => void
}

export function ParadigmInsertDialog({
  open,
  onOpenChange,
  languageId,
  onSelect,
}: ParadigmInsertDialogProps) {
  const [paradigms, setParadigms] = useState<Array<{ id: string; name: string; notes: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchParadigms() {
      if (!open || !languageId) return
      
      setLoading(true)
      setError(null)
      const result = await getParadigmsForLanguage(languageId)
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setParadigms(result.data)
      }
      setLoading(false)
    }

    fetchParadigms()
  }, [open, languageId])

  const handleSelect = (paradigmId: string, paradigmName: string) => {
    onSelect(paradigmId, paradigmName)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert Paradigm</DialogTitle>
          <DialogDescription>
            Select a paradigm table to embed in your content
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading paradigms...</span>
            </div>
          ) : error ? (
            <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : paradigms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Table2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No paradigms available.</p>
              <p className="text-xs mt-1">Create paradigms in the Paradigms section first.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {paradigms.map((paradigm) => (
                <Button
                  key={paradigm.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleSelect(paradigm.id, paradigm.name)}
                >
                  <Table2 className="h-4 w-4 mr-3 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{paradigm.name}</div>
                    {paradigm.notes && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {paradigm.notes}
                      </div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

