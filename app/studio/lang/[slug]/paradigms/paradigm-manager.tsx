"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createParadigm, updateParadigm, deleteParadigm } from "@/app/actions/paradigm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Pencil, Trash2, Plus, Info } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"
import { looksLikeIPA, extractIPA } from "@/lib/utils/ipa-detection"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { DeleteConfirmDialog } from "../dictionary/components/delete-confirm-dialog"
import { ParadigmContentEditor } from "./paradigm-content-editor"
import { Grid3X3 } from "lucide-react"

// Define types locally to avoid stale definition issues in IDE
type Paradigm = {
  id: string
  name: string
  slots: any // Json
  notes: string | null
  languageId: string
  createdAt: Date
  updatedAt: Date
}

interface ParadigmManagerProps {
  languageId: string
  paradigms: Paradigm[]
}

export function ParadigmManager({ languageId, paradigms: initialParadigms }: ParadigmManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingParadigm, setEditingParadigm] = useState<Paradigm | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isContentEditOpen, setIsContentEditOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    rows: "",
    columns: "",
    notes: "",
  })

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    try {
      const rows = formData.rows.split("\n").filter((r) => r.trim())
      const columns = formData.columns.split("\n").filter((c) => c.trim())

      const slots = {
        rows,
        columns,
        cells: rows.reduce((acc, row, rowIdx) => {
          columns.forEach((col, colIdx) => {
            acc[`${rowIdx}-${colIdx}`] = ""
          })
          return acc
        }, {} as Record<string, string>),
      }

      startTransition(async () => {
        const result = await createParadigm({
          name: formData.name,
          slots,
          notes: formData.notes.trim() || undefined,
          languageId,
        })

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          toast.success("Paradigm created successfully")
          setIsAddOpen(false)
          setFormData({ name: "", rows: "", columns: "", notes: "" })
          router.refresh()
        }
      })
    } catch (err) {
      setError("Invalid table structure")
      toast.error("Invalid table structure")
    }
  }

  const handleEdit = (paradigm: Paradigm) => {
    setEditingParadigm(paradigm)
    const slots = paradigm.slots as any
    setFormData({
      name: paradigm.name,
      rows: Array.isArray(slots.rows) ? slots.rows.join("\n") : "",
      columns: Array.isArray(slots.columns) ? slots.columns.join("\n") : "",
      notes: paradigm.notes || "",
    })
    setIsEditOpen(true)
    setError(null)
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!editingParadigm) return

    try {
      const rows = formData.rows.split("\n").filter((r) => r.trim())
      const columns = formData.columns.split("\n").filter((c) => c.trim())

      const slots = {
        rows,
        columns,
        cells: rows.reduce((acc, row, rowIdx) => {
          columns.forEach((col, colIdx) => {
            const key = `${rowIdx}-${colIdx}`
            const existingSlots = editingParadigm.slots as any
            acc[key] = existingSlots?.cells?.[key] || ""
          })
          return acc
        }, {} as Record<string, string>),
      }

      startTransition(async () => {
        const result = await updateParadigm({
          id: editingParadigm.id,
          name: formData.name,
          slots,
          notes: formData.notes.trim() === "" ? null : formData.notes.trim(),
          languageId,
        })

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          toast.success("Paradigm updated successfully")
          setIsEditOpen(false)
          setEditingParadigm(null)
          setFormData({ name: "", rows: "", columns: "", notes: "" })
          router.refresh()
        }
      })
    } catch (err) {
      setError("Invalid table structure")
      toast.error("Invalid table structure")
    }
  }

  const handleUpdateContent = async (id: string, cells: Record<string, string>) => {
    const paradigm = initialParadigms.find(p => p.id === id)
    if (!paradigm) return

    startTransition(async () => {
      const result = await updateParadigm({
        id,
        name: paradigm.name,
        notes: paradigm.notes || undefined,
        languageId,
        slots: {
          ...paradigm.slots,
          cells,
        },
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Paradigm content updated successfully")
        router.refresh()
      }
    })
  }

  const handleDelete = async () => {
    if (!deletingId) return

    startTransition(async () => {
      const result = await deleteParadigm(deletingId, languageId)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Paradigm deleted successfully")
        setDeletingId(null)
        setIsDeleteOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Paradigm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Create Paradigm Table</DialogTitle>
                <DialogDescription>
                  Define a declension or conjugation table. Row and column labels define the grid.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Name *</Label>
                  <Input
                    id="add-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. First Declension, Present Tense"
                    required
                    disabled={isPending}
                    maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="add-rows">Row Labels *</Label>
                    <p className="text-xs text-muted-foreground">One per line (e.g. cases)</p>
                    <Textarea
                      id="add-rows"
                      value={formData.rows}
                      onChange={(e) => setFormData({ ...formData, rows: e.target.value })}
                      placeholder="Singular&#10;Plural"
                      required
                      disabled={isPending}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-columns">Column Labels *</Label>
                    <p className="text-xs text-muted-foreground">One per line (e.g. persons)</p>
                    <Textarea
                      id="add-columns"
                      value={formData.columns}
                      onChange={(e) => setFormData({ ...formData, columns: e.target.value })}
                      placeholder="Nominative&#10;Genitive&#10;Dative"
                      required
                      disabled={isPending}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-notes">Notes (optional)</Label>
                  <Textarea
                    id="add-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional context or usage notes..."
                    disabled={isPending}
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create Paradigm"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {initialParadigms.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No paradigm tables yet"
          description="Create your first declension or conjugation table to organize word forms."
          action={{
            label: "Add Paradigm",
            href: "#", // Handled by onClick below
          }}
        />
      ) : (
        <div className="grid gap-6">
          {initialParadigms.map((paradigm) => {
            const slots = paradigm.slots as any
            const rows = Array.isArray(slots?.rows) ? slots.rows : []
            const columns = Array.isArray(slots?.columns) ? slots.columns : []
            const cells = slots?.cells || {}

            return (
              <Card key={paradigm.id} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-semibold">{paradigm.name}</CardTitle>
                      {paradigm.notes && (
                        <CardDescription className="flex items-center gap-1.5 mt-1">
                          <Info className="h-3.5 w-3.5" />
                          {paradigm.notes}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingParadigm(paradigm)
                          setIsContentEditOpen(true)
                        }}
                        disabled={isPending}
                        className="h-8 w-8 p-0"
                        title="Edit Content"
                      >
                        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(paradigm)}
                        disabled={isPending}
                        className="h-8 w-8 p-0"
                        title="Edit Structure"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(paradigm.id)
                          setIsDeleteOpen(true)
                        }}
                        disabled={isPending}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {rows.length > 0 && columns.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border/60">
                          <TableHead className="w-[150px] bg-muted/20"></TableHead>
                          {columns.map((col: string, idx: number) => (
                            <TableHead key={idx} className="bg-muted/20 font-semibold text-foreground/80 min-w-[120px]">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row: string, rowIdx: number) => (
                          <TableRow key={rowIdx} className="hover:bg-muted/5">
                            <TableCell className="font-medium bg-muted/10 text-muted-foreground border-r border-border/40">
                              {row}
                            </TableCell>
                            {columns.map((_: string, colIdx: number) => {
                              const cellValue = cells[`${rowIdx}-${colIdx}`] || "-"
                              const isIPA = cellValue !== "-" && looksLikeIPA(cellValue)
                              const ipaValue = isIPA ? extractIPA(cellValue) : null
                              const isEmpty = cellValue === "-" || cellValue === ""

                              return (
                                <TableCell key={colIdx} className={isEmpty ? "text-muted-foreground/30" : ""}>
                                  {isIPA && ipaValue ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{cellValue}</span>
                                      <IPASpeaker ipa={ipaValue} size="sm" />
                                    </div>
                                  ) : (
                                    <span className={isEmpty ? "" : "font-medium"}>{cellValue}</span>
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm italic">
                      No table structure defined
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Paradigm Table</DialogTitle>
              <DialogDescription>Update the paradigm table structure</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isPending}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-rows">Row Labels *</Label>
                  <Textarea
                    id="edit-rows"
                    value={formData.rows}
                    onChange={(e) => setFormData({ ...formData, rows: e.target.value })}
                    required
                    disabled={isPending}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-columns">Column Labels *</Label>
                  <Textarea
                    id="edit-columns"
                    value={formData.columns}
                    onChange={(e) => setFormData({ ...formData, columns: e.target.value })}
                    required
                    disabled={isPending}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={isPending}
                  rows={3}
                  maxLength={2000}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setEditingParadigm(null)
                  setFormData({ name: "", rows: "", columns: "", notes: "" })
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Updating..." : "Update Paradigm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        isPending={isPending}
      />

      <ParadigmContentEditor
        open={isContentEditOpen}
        onOpenChange={setIsContentEditOpen}
        paradigm={editingParadigm}
        onSave={handleUpdateContent}
        isPending={isPending}
      />
    </div>
  )
}
