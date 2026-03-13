"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  createDictionaryEntry,
  updateDictionaryEntry,
  deleteDictionaryEntry,
  bulkDeleteDictionaryEntries,
  deleteAllDictionaryEntries,
} from "@/app/actions/dictionary-entry"
import { Button } from "@/components/ui/button"
import { Download, Upload, Edit, Plus, Trash2, Sparkles, Languages } from "lucide-react"
import { BulkEdit } from "@/components/dictionary/bulk-edit"
import { TransliterationToggle } from "@/components/transliteration-toggle"
import { DictionarySearch } from "./components/dictionary-search"
import { DictionaryTable } from "./components/dictionary-table"
import { DictionaryTableMobile } from "@/components/dictionary/dictionary-table-mobile"
import { DictionaryEntryDialog } from "./components/dictionary-entry-dialog"
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog"
import { ImportDialog } from "./components/import-dialog"
import { DictionaryPagination } from "./components/dictionary-pagination"
import { DerivationWizard } from "./components/derivation-wizard"
import { WordGeneratorDialog } from "./components/word-generator-dialog"
import { BorrowWordDialog } from "./components/borrow-word-dialog"
import { EmptyState } from "@/components/empty-state"
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { FeatureHighlight } from "@/components/feature-highlight"
import { ContextualHelp } from "@/components/contextual-help"
import { EnhancedLoadingSkeleton } from "@/components/enhanced-loading-skeleton"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"

interface DictionaryManagerProps {
  languageId: string
  entries: DictionaryEntry[]
  symbols: ScriptSymbol[]
  currentPage: number
  totalPages: number
  totalEntries: number
  initialQuery: string
  initialField: string
  enableAudio: boolean
  ttsSettings?: {
    voiceId: string
    speed: string
  }
  allowsDiacritics?: boolean
  metadata?: Record<string, any>
  languageName?: string
}

export function DictionaryManager({
  languageId,
  entries: initialEntries,
  symbols,
  currentPage,
  totalPages,
  totalEntries,
  initialQuery,
  initialField,
  enableAudio,
  ttsSettings,
  allowsDiacritics = false,
  metadata = {},
  languageName = "Language",
}: DictionaryManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [showLatin, setShowLatin] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [isDeriveOpen, setIsDeriveOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [isBorrowOpen, setIsBorrowOpen] = useState(false)
  const [prefillLemma, setPrefillLemma] = useState<string | null>(null)

  // Selection State
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null)
  const [derivationSourceEntry, setDerivationSourceEntry] = useState<DictionaryEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "n",
      metaKey: true,
      handler: () => {
        if (!isAddOpen && !isEditOpen) {
          setIsAddOpen(true)
        }
      },
    },
    {
      key: "/",
      metaKey: true,
      handler: () => {
        setShowShortcuts(true)
      },
    },
    {
      key: "Escape",
      handler: () => {
        if (isAddOpen) setIsAddOpen(false)
        if (isEditOpen) setIsEditOpen(false)
        if (isDeleteOpen) setIsDeleteOpen(false)
        if (isImportOpen) setIsImportOpen(false)
        if (isBulkEditOpen) setIsBulkEditOpen(false)
        if (isDeriveOpen) setIsDeriveOpen(false)
        if (isBulkDeleteOpen) setIsBulkDeleteOpen(false)
        if (isDeleteAllOpen) setIsDeleteAllOpen(false)
      },
    },
  ])

  // URL Updates
  const updateUrl = useCallback((newPage: number, newQuery: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newPage > 1) params.set("page", newPage.toString())
    else params.delete("page")

    if (newQuery) params.set("q", newQuery)
    else params.delete("q")

    // Preserve the field parameter if it exists in the current URL or if we're not changing it here
    // But actually DictionarySearch will handle calling handleSearch with both arguments


    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [pathname, router, searchParams])

  const handleSearch = useCallback((query: string, field?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query) params.set("q", query)
    else params.delete("q")

    if (field) params.set("f", field)
    else params.delete("f")

    params.delete("page") // Reset to page 1 on search

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [pathname, router, searchParams])

  const handlePageChange = useCallback((page: number) => {
    updateUrl(page, initialQuery)
  }, [updateUrl, initialQuery])

  const handleCreate = async (data: any) => {
    // Use JSON.parse(JSON.stringify()) to ensure a strictly plain object for the Server Action
    // Using undefined ensures JSON.stringify omits the key, which Zod expects for optional fields
    const sterilizedData = JSON.parse(JSON.stringify({
      lemma: String(data.lemma),
      gloss: String(data.gloss),
      languageId,
      ipa: data.ipa || null,
      partOfSpeech: data.partOfSpeech || null,
      etymology: data.etymology || null,
      notes: data.notes || null,
      relatedWords: data.relatedWords && data.relatedWords.length > 0 ? data.relatedWords : null,
      tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
    }))

    const result = await createDictionaryEntry(sterilizedData)

    if (result.error) {
      toast.error(result.error, {
        action: {
          label: "Retry",
          onClick: () => handleCreate(data),
        },
      })
    } else {
      toast.success(`"${data.lemma}" added successfully`, {
        action: {
          label: "Add Another",
          onClick: () => {
            setIsAddOpen(true)
          },
        },
      })
      setIsAddOpen(false)
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const handleDeriveSubmit = async (data: any) => {
    // Use JSON.parse(JSON.stringify()) to ensure a strictly plain object for the Server Action
    const sterilizedData = JSON.parse(JSON.stringify({
      lemma: String(data.lemma),
      gloss: String(data.gloss),
      languageId,
      ipa: data.ipa || null,
      partOfSpeech: data.partOfSpeech || null,
      etymology: data.etymology || null,
      notes: data.notes || null,
      relatedWords: data.relatedWords && data.relatedWords.length > 0 ? data.relatedWords : null,
    }))

    const result = await createDictionaryEntry(sterilizedData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`derived word "${data.lemma}" created`)
      setIsDeriveOpen(false)
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const handleUpdate = async (data: any) => {
    if (!editingEntry) return

    // Use JSON.parse(JSON.stringify()) to ensure a strictly plain object for the Server Action
    const sterilizedData = JSON.parse(JSON.stringify({
      id: String(editingEntry.id),
      lemma: String(data.lemma),
      gloss: String(data.gloss),
      languageId,
      ipa: data.ipa || null,
      partOfSpeech: data.partOfSpeech || null,
      etymology: data.etymology || null,
      notes: data.notes || null,
      relatedWords: data.relatedWords && data.relatedWords.length > 0 ? data.relatedWords : null,
    }))

    const result = await updateDictionaryEntry(sterilizedData)

    if (result.error) {
      toast.error(result.error, {
        action: {
          label: "Retry",
          onClick: () => handleUpdate(data),
        },
      })
    } else {
      toast.success(`"${data.lemma}" updated successfully`)
      setIsEditOpen(false)
      setEditingEntry(null)
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return

    const deletedEntry = initialEntries.find(e => e.id === deletingId)
    const entryLemma = deletedEntry?.lemma || "entry"

    const result = await deleteDictionaryEntry(deletingId, languageId)

    if (result.error) {
      toast.error(result.error, {
        action: {
          label: "Retry",
          onClick: () => handleDelete(),
        },
      })
    } else {
      toast.success(`"${entryLemma}" deleted successfully`, {
        action: {
          label: "Undo",
          onClick: async () => {
            // Note: Undo would require restoring the entry
            // This is a placeholder for future implementation
            toast.info("Undo functionality coming soon")
          },
        },
      })
      setIsDeleteOpen(false)
      setDeletingId(null)

      // Remove from selection if selected
      if (selectedEntries.has(deletingId)) {
        const newSelected = new Set(selectedEntries)
        newSelected.delete(deletingId)
        setSelectedEntries(newSelected)
      }

      startTransition(() => {
        router.refresh()
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return

    const ids = Array.from(selectedEntries)
    const result = await bulkDeleteDictionaryEntries(ids, languageId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Deleted ${result.deletedCount} entries`)
      setIsBulkDeleteOpen(false)
      setSelectedEntries(new Set())
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const handleDeleteAll = async () => {
    const result = await deleteAllDictionaryEntries(languageId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Deleted all ${result.deletedCount} entries`)
      setIsDeleteAllOpen(false)
      setSelectedEntries(new Set())
      startTransition(() => {
        router.refresh()
      })
    }
  }

  const handleImport = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("languageId", languageId)

      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Import failed")
      }

      toast.success(
        `Imported ${result.imported} entries${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ""}`,
        {
          description: result.errors > 0 ? `${result.errors} errors occurred` : undefined,
        }
      )

      setIsImportOpen(false)
      router.refresh()
    } catch (error) {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Feature Highlight for Bulk Operations */}
      {selectedEntries.size === 0 && initialEntries.length > 0 && (
        <FeatureHighlight
          id="bulk-operations"
          title="Bulk Operations"
          description="Select multiple entries to edit, export, or delete them at once. Use the checkboxes to select items."
          variant="tip"
        />
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 w-full">
          <DictionarySearch
            onSearch={handleSearch}
            defaultValue={initialQuery}
            defaultField={initialField}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <TransliterationToggle
            onToggle={setShowLatin}
            defaultShowLatin={showLatin}
          />

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const url = `/api/export/csv?languageId=${languageId}`
              window.open(url, "_blank")
              toast.success("Dictionary exported successfully")
            }}
            disabled={isPending || totalEntries === 0}
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsImportOpen(true)}
            disabled={isPending}
            title="Import CSV"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsGeneratorOpen(true)}
            disabled={isPending}
            title="Generate Words"
          >
            <Sparkles className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsBorrowOpen(true)}
            disabled={isPending}
            title="Borrow Word"
          >
            <Languages className="h-4 w-4" />
          </Button>

          <ContextualHelp
            content="Use Cmd+N to quickly add a new entry. Cmd+/ shows all keyboard shortcuts."
            shortcut="⌘N"
          />

          {selectedEntries.size > 0 && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsBulkEditOpen(true)}
                disabled={isPending}
                title={`Bulk Edit (${selectedEntries.size})`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={isPending}
                title={`Delete Selected (${selectedEntries.size})`}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button type="button" onClick={() => setIsAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Entry</span>
          </Button>
        </div>
      </div>

      {initialEntries.length === 0 ? (
        initialQuery ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">
              No entries match your search.
            </p>
            <Button type="button" variant="link" onClick={() => handleSearch("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={Plus}
            title="No dictionary entries yet"
            description="Start building your lexicon by adding your first word."
            action={{
              label: "Add Entry",
              onClick: () => setIsAddOpen(true),
            }}
          />
        )
      ) : (
        <>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Showing {initialEntries.length} of {totalEntries} entries
            </span>
            {selectedEntries.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEntries(new Set())}
                className="h-auto p-0 hover:bg-transparent hover:text-foreground"
              >
                Clear selection ({selectedEntries.size})
              </Button>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <DictionaryTable
              entries={initialEntries}
              selectedEntries={selectedEntries}
              onSelectChange={setSelectedEntries}
              onEdit={(entry) => {
                setEditingEntry(entry)
                setIsEditOpen(true)
              }}
              onDelete={(id) => {
                setDeletingId(id)
                setIsDeleteOpen(true)
              }}
              showLatin={showLatin}
              symbols={symbols}
              isPending={isPending}
              onDerive={(entry) => {
                setDerivationSourceEntry(entry)
                setIsDeriveOpen(true)
              }}
            />
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            <DictionaryTableMobile
              entries={initialEntries}
              selectedEntries={selectedEntries}
              onSelectionChange={setSelectedEntries}
              onEdit={(entry) => {
                setEditingEntry(entry)
                setIsEditOpen(true)
              }}
              onDelete={(entry) => {
                setDeletingId(entry.id)
                setIsDeleteOpen(true)
              }}
              showLatin={showLatin}
              symbols={symbols}
              enableAudio={enableAudio}
              onDerive={(entry) => {
                setDerivationSourceEntry(entry)
                setIsDeriveOpen(true)
              }}
            />
          </div>

          <DictionaryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />

          {selectedEntries.size === 0 && totalEntries > 0 && (
            <div className="flex justify-end pt-8">
              <Button
                variant="outline"
                onClick={() => setIsDeleteAllOpen(true)}
                disabled={isPending}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete All {totalEntries} Entries
              </Button>
            </div>
          )}
        </>
      )}

      <DictionaryEntryDialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open)
          if (!open) setPrefillLemma(null)
        }}
        onSubmit={handleCreate}
        isPending={isPending}
        mode="create"
        symbols={symbols}
        allowsDiacritics={allowsDiacritics}
        initialData={prefillLemma ? { lemma: prefillLemma } as any : undefined}
      />

      <DictionaryEntryDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleUpdate}
        initialData={editingEntry}
        isPending={isPending}
        mode="edit"
        symbols={symbols}
        allowsDiacritics={allowsDiacritics}
      />

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        isPending={isPending}
        itemName={deletingId ? initialEntries?.find(e => e.id === deletingId)?.lemma : undefined}
        description={deletingId ? `This will permanently delete the dictionary entry "${initialEntries?.find(e => e.id === deletingId)?.lemma}". This action cannot be undone.` : undefined}
      />

      <DeleteConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        isPending={isPending}
        title={`Delete ${selectedEntries.size} entries?`}
        description={`This will permanently delete ${selectedEntries.size} selected dictionary entries. This action cannot be undone.`}
      />

      <DeleteConfirmDialog
        open={isDeleteAllOpen}
        onOpenChange={setIsDeleteAllOpen}
        onConfirm={handleDeleteAll}
        isPending={isPending}
        title={`Delete all ${totalEntries} entries?`}
        description={`This will permanently delete ALL ${totalEntries} dictionary entries for this language. This action cannot be undone.`}
      />

      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImport}
        isPending={isPending}
      />

      <DerivationWizard
        open={isDeriveOpen}
        onOpenChange={setIsDeriveOpen}
        sourceEntry={derivationSourceEntry}
        allEntries={initialEntries}
        onSubmit={handleDeriveSubmit}
        isPending={isPending}
      />

      <WordGeneratorDialog
        open={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        symbols={symbols}
        metadata={metadata}
        existingLemmas={initialEntries.map(e => e.lemma)}
        onAddWord={(word) => {
          setPrefillLemma(word)
          setIsAddOpen(true)
        }}
      />

      <BorrowWordDialog
        open={isBorrowOpen}
        onOpenChange={setIsBorrowOpen}
        languageId={languageId}
        languageName={languageName}
        onBorrow={(data) => handleCreate(data)}
      />

      {isBulkEditOpen && (
        <BulkEdit
          entryIds={Array.from(selectedEntries)}
          languageId={languageId}
          onClose={() => {
            setIsBulkEditOpen(false)
            setSelectedEntries(new Set())
          }}
        />
      )}

      <KeyboardShortcutsHelp
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        shortcuts={[
          {
            category: "Dictionary",
            keys: ["⌘", "N"],
            description: "New entry",
          },
          {
            category: "Dictionary",
            keys: ["Esc"],
            description: "Close dialog",
          },
          {
            category: "General",
            keys: ["⌘", "/"],
            description: "Show keyboard shortcuts",
          },
        ]}
      />
    </div>
  )
}
