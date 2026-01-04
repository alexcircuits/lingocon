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
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useState } from "react"
import { toast } from "sonner"
import { parseCSV, validateCSVData } from "@/lib/utils/csv-parser"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (file: File) => Promise<void>
  isPending?: boolean
}

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  isPending,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Array<Record<string, string>> | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

    try {
      const text = await selectedFile.text()
      const rows = parseCSV(text)
      const validation = validateCSVData(rows)

      if (!validation.valid) {
        toast.error("CSV validation failed", {
          description: validation.errors.join(", "),
        })
        setPreview(null)
        return
      }

      setPreview(rows.slice(0, 10))
      if (rows.length > 10) {
        toast.info(`Preview showing first 10 of ${rows.length} rows`)
      }
    } catch (error) {
      toast.error("Failed to parse CSV file", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      setPreview(null)
    }
  }

  const handleImport = async () => {
    if (!file) return
    await onImport(file)
    // Reset state on success (parent handles closing)
    setFile(null)
    setPreview(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Dictionary from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: Lemma, Gloss, IPA (optional), Part of Speech (optional), Notes (optional)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              CSV should have headers: Lemma, Gloss, IPA, Part of Speech, Notes
            </p>
          </div>

          {preview && (
            <div className="space-y-2">
              <Label>Preview (first {Math.min(10, preview.length)} rows)</Label>
              <div className="rounded-md border max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lemma</TableHead>
                      <TableHead>Gloss</TableHead>
                      <TableHead>IPA</TableHead>
                      <TableHead>Part of Speech</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.lemma}</TableCell>
                        <TableCell>{row.gloss}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.ipa ? `/${row.ipa}/` : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.partOfSpeech || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setFile(null)
              setPreview(null)
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isPending || !preview}
          >
            {isPending ? "Importing..." : "Import Entries"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

