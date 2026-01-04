"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface ParadigmContentEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paradigm: {
    id: string
    name: string
    slots: any
  } | null
  onSave: (id: string, cells: Record<string, string>) => Promise<void>
  isPending: boolean
}

export function ParadigmContentEditor({
  open,
  onOpenChange,
  paradigm,
  onSave,
  isPending,
}: ParadigmContentEditorProps) {
  const [cells, setCells] = useState<Record<string, string>>({})

  // Initialize cells when paradigm changes
  if (paradigm && Object.keys(cells).length === 0 && open) {
    setCells(paradigm.slots.cells || {})
  }

  if (!paradigm) return null

  const slots = paradigm.slots
  const rows = Array.isArray(slots.rows) ? slots.rows : []
  const columns = Array.isArray(slots.columns) ? slots.columns : []

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const key = `${rowIdx}-${colIdx}`
    setCells((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    await onSave(paradigm.id, cells)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Paradigm Content: {paradigm.name}</DialogTitle>
          <DialogDescription>
            Fill in the forms for this paradigm table.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] bg-muted/50"></TableHead>
                  {columns.map((col: string, idx: number) => (
                    <TableHead key={idx} className="bg-muted/50 font-semibold min-w-[150px]">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: string, rowIdx: number) => (
                  <TableRow key={rowIdx}>
                    <TableCell className="font-medium bg-muted/20">
                      {row}
                    </TableCell>
                    {columns.map((_: string, colIdx: number) => {
                      const key = `${rowIdx}-${colIdx}`
                      return (
                        <TableCell key={colIdx} className="p-2">
                          <Input
                            value={cells[key] || ""}
                            onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                            className="h-9"
                            placeholder="-"
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

