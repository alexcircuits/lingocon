"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createScriptSymbol,
  updateScriptSymbol,
  deleteScriptSymbol,
  reorderScriptSymbols,
} from "@/app/actions/script-symbol"
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
import { Input } from "@/components/ui/input"
import { IPAInput } from "@/components/ui/ipa-input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, MoreVertical, Pencil, Trash2, Plus } from "lucide-react"
import { TransliterationToggle } from "@/components/transliteration-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"

// Define locally to avoid stale client issues
type ScriptSymbol = {
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

export function AlphabetManager({ languageId, symbols: initialSymbols }: AlphabetManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [symbols, setSymbols] = useState<ScriptSymbol[]>(initialSymbols)
  const [editingSymbol, setEditingSymbol] = useState<ScriptSymbol | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Removed showLatin toggle - now always showing both native and latin together
  const [formData, setFormData] = useState({
    symbol: "",
    capitalSymbol: "",
    ipa: "",
    latin: "",
    name: "",
  })

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const maxOrder = symbols.length > 0 ? Math.max(...symbols.map((s) => s.order)) : -1
      const result = await createScriptSymbol({
        ...formData,
        order: maxOrder + 1,
        languageId,
      })

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Symbol added successfully")
        setIsAddOpen(false)
        setFormData({ symbol: "", capitalSymbol: "", ipa: "", latin: "", name: "" })
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
      const result = await updateScriptSymbol({
        id: editingSymbol.id,
        ...formData,
        order: editingSymbol.order,
        languageId,
      })

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Symbol updated successfully")
        setIsEditOpen(false)
        setEditingSymbol(null)
        setFormData({ symbol: "", capitalSymbol: "", ipa: "", latin: "", name: "" })
        router.refresh()
      }
    })
  }

  const handleDelete = async (symbolId: string) => {
    startTransition(async () => {
      const result = await deleteScriptSymbol(symbolId, languageId)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Symbol deleted successfully")
        router.refresh()
      }
    })
  }

  const handleReorder = async (symbolId: string, direction: "up" | "down") => {
    startTransition(async () => {
      const result = await reorderScriptSymbols(symbolId, languageId, direction)

      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
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

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-symbol">Lowercase</Label>
                    <Input
                      id="add-symbol"
                      value={formData.symbol}
                      onChange={(e) =>
                        setFormData({ ...formData, symbol: e.target.value })
                      }
                      placeholder="a"
                      required
                      disabled={isPending}
                      maxLength={10}
                      className="text-lg font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-capital">Uppercase (optional)</Label>
                    <Input
                      id="add-capital"
                      value={formData.capitalSymbol}
                      onChange={(e) =>
                        setFormData({ ...formData, capitalSymbol: e.target.value })
                      }
                      placeholder="A"
                      disabled={isPending}
                      maxLength={10}
                      className="text-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-ipa">IPA (optional)</Label>
                    <IPAInput
                      id="add-ipa"
                      value={formData.ipa}
                      onChange={(value) =>
                        setFormData({ ...formData, ipa: value })
                      }
                      placeholder="/a/"
                      disabled={isPending}
                      maxLength={50}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-latin">Latin (optional)</Label>
                    <Input
                      id="add-latin"
                      value={formData.latin}
                      onChange={(e) =>
                        setFormData({ ...formData, latin: e.target.value })
                      }
                      placeholder="a"
                      disabled={isPending}
                      maxLength={10}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-name">Name (optional)</Label>
                  <Input
                    id="add-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Letter A"
                    disabled={isPending}
                    maxLength={200}
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
            href: "#", // Handled by onClick below
          }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {symbols.map((symbol, index) => (
            <Card key={symbol.id} className="relative group hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px]">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(symbol)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleReorder(symbol.id, "up")}
                        disabled={index === 0 || isPending}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Move Left
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleReorder(symbol.id, "down")}
                        disabled={index === symbols.length - 1 || isPending}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Move Right
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(symbol.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="text-4xl font-serif font-medium mb-2 flex items-center justify-center gap-1">
                  {symbol.capitalSymbol ? (
                    <>
                      <span>{symbol.capitalSymbol}</span>
                      <span>{symbol.symbol}</span>
                    </>
                  ) : (
                    <span>{symbol.symbol}</span>
                  )}
                  {symbol.latin && symbol.latin !== symbol.symbol && (
                    <>
                      <span className="text-muted-foreground/30 mx-1">/</span>
                      <span className="text-2xl text-muted-foreground">{symbol.latin}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1">
                  {symbol.ipa && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      /{symbol.ipa}/
                    </Badge>
                  )}
                  {symbol.name && (
                    <span className="text-xs text-muted-foreground text-center">
                      {symbol.name}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-symbol">Lowercase</Label>
                  <Input
                    id="edit-symbol"
                    value={formData.symbol}
                    onChange={(e) =>
                      setFormData({ ...formData, symbol: e.target.value })
                    }
                    required
                    disabled={isPending}
                    maxLength={10}
                    className="text-lg font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-capital">Uppercase (optional)</Label>
                  <Input
                    id="edit-capital"
                    value={formData.capitalSymbol}
                    onChange={(e) =>
                      setFormData({ ...formData, capitalSymbol: e.target.value })
                    }
                    disabled={isPending}
                    maxLength={10}
                    className="text-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-ipa">IPA (optional)</Label>
                  <IPAInput
                    id="edit-ipa"
                    value={formData.ipa}
                    onChange={(value) =>
                      setFormData({ ...formData, ipa: value })
                    }
                    disabled={isPending}
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-latin">Latin (optional)</Label>
                  <Input
                    id="edit-latin"
                    value={formData.latin}
                    onChange={(e) =>
                      setFormData({ ...formData, latin: e.target.value })
                    }
                    disabled={isPending}
                    maxLength={10}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Name (optional)</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={isPending}
                  maxLength={200}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setEditingSymbol(null)
                  setFormData({ symbol: "", capitalSymbol: "", ipa: "", latin: "", name: "" })
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
