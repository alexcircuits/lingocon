"use client"

import { memo, useCallback, useMemo, useState, useTransition, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { useStudioAccess } from "@/components/studio-access"

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

interface SymbolGridProps {
  symbols: ScriptSymbol[]
  isPending: boolean
  /** Cards without drag handles or edit/move/delete menus. */
  readOnly: boolean
  onEdit: (symbol: ScriptSymbol) => void
  onDelete: (id: string) => void
  onReorder: (id: string, direction: "up" | "down") => void
  onDragEnd: (event: DragEndEvent) => void
}

/**
 * The sortable symbol cards. Memoized with stable callbacks: the add/edit form's state lives in
 * the manager, and typing in it used to re-render every card (each a dnd-kit sortable) per
 * keystroke.
 */
const SymbolGrid = memo(function SymbolGrid({ symbols, isPending, readOnly, onEdit, onDelete, onReorder, onDragEnd }: SymbolGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = useMemo(() => symbols.map((s) => s.id), [symbols])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={ids}
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
              readOnly={readOnly}
              onEdit={onEdit}
              onDelete={onDelete}
              onReorder={onReorder}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
})

export function AlphabetManager({ languageId, symbols: initialSymbols }: AlphabetManagerProps) {
  const t = useTranslations("studio.alphabet")
  const tc = useTranslations("studio.common")
  // Visitors without the alphabet scope see the symbols only: no add, edit, move or delete.
  const canEdit = useStudioAccess().canWrite("write:alphabet")
  const [isPending, startTransition] = useTransition()
  const [symbols, setSymbols] = useState<ScriptSymbol[]>(initialSymbols)
  const [editingSymbol, setEditingSymbol] = useState<ScriptSymbol | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<SymbolFormData>(emptyForm)
  const [pendingDelete, setPendingDelete] = useState<ScriptSymbol | null>(null)

  // Server props are authoritative, except while this tab still has reorders in
  // flight: the first save's re-render would otherwise snap the list back to an
  // intermediate order before the later save lands.
  const latestServerSymbols = useRef(initialSymbols)
  const pendingReorders = useRef(0)
  useEffect(() => {
    latestServerSymbols.current = initialSymbols
    if (pendingReorders.current === 0) setSymbols(initialSymbols)
  }, [initialSymbols])

  const persistOrder = useCallback((newSymbols: ScriptSymbol[]) => {
    setSymbols(newSymbols)
    pendingReorders.current += 1
    startTransition(async () => {
      try {
        const result = await saveAlphabetOrder(newSymbols.map(s => s.id), languageId)
        if ('error' in result) {
          setError(result.error ?? null)
          toast.error(result.error)
          setSymbols(latestServerSymbols.current)
        }
        // On success the action's response re-renders this route with the saved order.
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
        setSymbols(latestServerSymbols.current)
      } finally {
        pendingReorders.current -= 1
      }
    })
  }, [languageId])

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

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(t("symbolAdded"))
        setIsAddOpen(false)
        setFormData(emptyForm)
        // The action's response already re-rendered this route.
      }
    })
  }

  const handleEdit = useCallback((symbol: ScriptSymbol) => {
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
  }, [])

  const requestDelete = useCallback((id: string) => {
    setPendingDelete(symbols.find((s) => s.id === id) ?? null)
  }, [symbols])

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
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(t("symbolUpdated"))
        setIsEditOpen(false)
        setEditingSymbol(null)
        setFormData(emptyForm)
        // The action's response already re-rendered this route.
      }
    })
  }

  const handleDelete = async (symbolId: string) => {
    startTransition(async () => {
      const result = await deleteScriptSymbol(symbolId, languageId)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(t("symbolDeleted"))
      }
    })
  }

  const handleReorder = useCallback((symbolId: string, direction: "up" | "down") => {
    const currentIndex = symbols.findIndex((s) => s.id === symbolId)
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

    if (newIndex < 0 || newIndex >= symbols.length) return

    persistOrder(arrayMove(symbols, currentIndex, newIndex))
  }, [symbols, persistOrder])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = symbols.findIndex((s) => s.id === active.id)
      const newIndex = symbols.findIndex((s) => s.id === over.id)

      persistOrder(arrayMove(symbols, oldIndex, newIndex))
    }
  }, [symbols, persistOrder])

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t("addSymbol")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAdd}>
                <DialogHeader>
                  <DialogTitle>{t("addSymbolTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("addSymbolDesc")}
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
                    {tc("cancel")}
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? t("addingSymbol") : t("addSymbol")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {symbols.length === 0 ? (
        <EmptyState
          icon={Plus}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={canEdit ? {
            label: t("addSymbol"),
            onClick: () => setIsAddOpen(true),
          } : undefined}
        />
      ) : (
        <SymbolGrid
          symbols={symbols}
          isPending={isPending}
          readOnly={!canEdit}
          onEdit={handleEdit}
          onDelete={requestDelete}
          onReorder={handleReorder}
          onDragEnd={handleDragEnd}
        />
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>{t("editSymbolTitle")}</DialogTitle>
              <DialogDescription>
                {t("editSymbolDesc")}
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
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("updating") : t("updateSymbol")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete.id)
          setPendingDelete(null)
        }}
        title={t("confirmDeleteTitle", { symbol: pendingDelete?.symbol ?? "" })}
        description={t("confirmDeleteDesc")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  )
}
