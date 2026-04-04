"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createScriptSymbol,
  updateScriptSymbol,
  deleteScriptSymbol,
  saveAlphabetOrder,
} from "@/app/actions/script-symbol"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { SymbolFormFields, type SymbolFormData } from "./symbol-form-fields"
import { SortableSymbol } from "./sortable-symbol"

// Define locally to avoid stale client issues
export type ScriptSymbol = {
  id: string
  symbol: string
  capitalSymbol: string | null
  ipa: string | null
  latin: string | null
  name: string | null
  order: number
  languageId: string
  createdAt: Date
  updatedAt: Date
}

interface AlphabetManagerProps {
  languageId: string
  symbols: ScriptSymbol[]
}

const emptyForm: SymbolFormData = { symbol: "", capitalSymbol: "", ipa: "", latin: "", name: "" }

export function AlphabetManager({ languageId, symbols: initialSymbols }: AlphabetManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [symbols, setSymbols] = useState<ScriptSymbol[]>(initialSymbols)
  const [editingSymbol, setEditingSymbol] = useState<ScriptSymbol | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<SymbolFormData>(emptyForm)

  useEffect(() => {
    setSymbols(initialSymbols)
  }, [initialSymbols])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const maxOrder = symbols.length > 0 ? Math.max(...symbols.map((s) => s.order)) : -1
      const sterilizedData = JSON.parse(JSON.stringify({
        symbol: String(formData.symbol),
        order: maxOrder + 1,
        languageId,
        capitalSymbol: formData.capitalSymbol || undefined,
        ipa: formData.ipa || undefined,
        latin: formData.latin || undefined,
        name: formData.name || undefined,
      }))

      const result = await createScriptSymbol(sterilizedData)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Symbol added successfully")
        setIsAddOpen(false)
        setFormData(emptyForm)
        router.refresh()
      }
    })
  }

  const handleEdit = (symbol: ScriptSymbol) => {
    setEditingSymbol(symbol)
    setFormData({
      symbol: symbol.symbol,
      capitalSymbol: symbol.capitalSymbol || "",
      ipa: symbol.ipa || "",
      latin: symbol.latin || "",
      name: symbol.name || "",
    })
    setIsEditOpen(true)
    setError(null)
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!editingSymbol) return

    startTransition(async () => {
      const sterilizedData = JSON.parse(JSON.stringify({
        id: String(editingSymbol.id),
        symbol: String(formData.symbol),
        order: editingSymbol.order,
        languageId,
        capitalSymbol: formData.capitalSymbol || undefined,
        ipa: formData.ipa || undefined,
        latin: formData.latin || undefined,
        name: formData.name || undefined,
      }))

      const result = await updateScriptSymbol(sterilizedData)

      if ('error' in result) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Symbol updated successfully")
        setIsEditOpen(false)
        setEditingSymbol(null)
        setFormData(emptyForm)
        router.refresh()
      }
    })
  }

  const handleDelete = async (symbolId: string) => {
    startTransition(async () => {
      const result = await deleteScriptSymbol(symbolId, languageId)

      if ('error' in result) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Symbol deleted successfully")
        router.refresh()
      }
    })
  }

  const handleReorder = async (symbolId: string, direction: "up" | "down") => {
    const currentIndex = symbols.findIndex((s) => s.id === symbolId)
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

    if (newIndex < 0 || newIndex >= symbols.length) return

    const newSymbols = arrayMove(symbols, currentIndex, newIndex)
    setSymbols(newSymbols)

    startTransition(async () => {
      const result = await saveAlphabetOrder(newSymbols.map(s => s.id), languageId)

      if ('error' in result) {
        setError(result.error)
        toast.error(result.error)
        setSymbols(initialSymbols)
      } else {
        router.refresh()
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = symbols.findIndex((s) => s.id === active.id)
      const newIndex = symbols.findIndex((s) => s.id === over.id)

      const newSymbols = arrayMove(symbols, oldIndex, newIndex)
      setSymbols(newSymbols)

      startTransition(async () => {
        const result = await saveAlphabetOrder(newSymbols.map(s => s.id), languageId)

        if ('error' in result) {
          setError(result.error)
          toast.error(result.error)
          setSymbols(initialSymbols)
        } else {
          router.refresh()
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Symbol
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Add Script Symbol</DialogTitle>
                <DialogDescription>
                  Add a new symbol to the alphabet
                </DialogDescription>
              </DialogHeader>

              <SymbolFormFields
                formData={formData}
                onChange={setFormData}
                isPending={isPending}
                idPrefix="add"
              />

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
                  {isPending ? "Adding..." : "Add Symbol"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {symbols.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No symbols yet"
          description="Start building your alphabet by adding your first symbol."
          action={{
            label: "Add Symbol",
            onClick: () => setIsAddOpen(true),
          }}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={symbols.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {symbols.map((symbol, index) => (
                <SortableSymbol
                  key={symbol.id}
                  symbol={symbol}
                  index={index}
                  totalCount={symbols.length}
                  isPending={isPending}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Script Symbol</DialogTitle>
              <DialogDescription>
                Update the symbol details
              </DialogDescription>
            </DialogHeader>

            <SymbolFormFields
              formData={formData}
              onChange={setFormData}
              isPending={isPending}
              idPrefix="edit"
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setEditingSymbol(null)
                  setFormData(emptyForm)
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Updating..." : "Update Symbol"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
