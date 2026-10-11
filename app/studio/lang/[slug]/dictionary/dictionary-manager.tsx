"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useRevealCreatedEntry } from "@/lib/hooks/use-reveal-created-entry"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { readJson, NonJsonResponseError } from "@/lib/utils/http-response"
import {
  createDictionaryEntry,
  updateDictionaryEntry,
  deleteDictionaryEntry,
  bulkDeleteDictionaryEntries,
  deleteAllDictionaryEntries,
} from "@/app/actions/dictionary-entry"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { DictionaryToolbar } from "./components/dictionary-toolbar"
import { DictionaryTable } from "./components/dictionary-table"
import { DictionaryTableMobile } from "@/components/dictionary/dictionary-table-mobile"
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog"
import { DictionaryPagination } from "@/components/dictionary/dictionary-pagination"
import { EmptyState } from "@/components/empty-state"
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import { useOpenedOnce } from "@/lib/hooks/use-opened-once"
import { useSectionWritable } from "@/components/studio-access"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { FeatureHighlight } from "@/components/feature-highlight"
import type { DictionaryEntry, ScriptSymbol } from "@prisma/client"
import type { LanguageMetadata } from "@/lib/validations/language"

// Dialogs are code-split from the word list and mount the first time they are opened (see
// useOpenedOnce). The add/edit dialog's chunk is also preloaded once the page is idle, so the
// first ⌘N opens it at once; a failed preload (offline, a deploy) costs nothing, whereas a
// closed dialog that failed to load used to replace the whole dictionary with an error.
const loadEntryDialog = () => import("./components/dictionary-entry-dialog")
const DictionaryEntryDialog = dynamic(() => loadEntryDialog().then((m) => m.DictionaryEntryDialog))
const ImportDialog = dynamic(() => import("./components/import-dialog").then((m) => m.ImportDialog))
const DerivationWizard = dynamic(() => import("./components/derivation-wizard").then((m) => m.DerivationWizard))
const WordGeneratorDialog = dynamic(() => import("./components/word-generator-dialog").then((m) => m.WordGeneratorDialog))
const BorrowWordDialog = dynamic(() => import("./components/borrow-word-dialog").then((m) => m.BorrowWordDialog))
const BulkAddDialog = dynamic(() => import("./components/bulk-add-dialog").then((m) => m.BulkAddDialog))
const FindReplaceDialog = dynamic(() => import("./components/find-replace-dialog").then((m) => m.FindReplaceDialog))
const BulkEdit = dynamic(() => import("@/components/dictionary/bulk-edit").then((m) => m.BulkEdit))
const KeyboardShortcutsHelp = dynamic(() => import("@/components/keyboard-shortcuts-help").then((m) => m.KeyboardShortcutsHelp))

interface DictionaryManagerProps {
  languageId: string
  entries: DictionaryEntry[]
  symbols: ScriptSymbol[]
  currentPage: number
  totalPages: number
  totalEntries: number
  initialQuery: string
  initialField: string
  initialSort?: string
  enableAudio: boolean
  ttsSettings?: {
    voiceId: string
    speed: string
  }
  allowsDiacritics?: boolean
  metadata?: LanguageMetadata
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
  initialSort = "lemma",
  enableAudio,
  ttsSettings,
  allowsDiacritics = false,
  metadata = {},
  languageName = "Language",
}: DictionaryManagerProps) {
  const router = useRouter()
  const t = useTranslations("studio.dictionary")
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // A new word sorted onto another page (or hidden by the current filter) looks
  // unsaved; switch to the newest-first view so it is on screen.
  const isNewestFirstView = currentPage === 1 && initialSort === "createdAt" && !initialQuery
  const revealCreatedEntry = useCallback(() => {
    if (isNewestFirstView) return
    startTransition(() => {
      router.replace(`${pathname}?sort=createdAt`)
    })
  }, [isNewestFirstView, pathname, router])
  const createdEntryReveal = useRevealCreatedEntry(languageId, initialEntries, revealCreatedEntry)

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
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false)
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false)
  const [prefillData, setPrefillData] = useState<{ lemma?: string; gloss?: string } | null>(null)

  // Selection State
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null)
  const [derivationSourceEntry, setDerivationSourceEntry] = useState<DictionaryEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const canEdit = useSectionWritable()
  const addMounted = useOpenedOnce(isAddOpen)
  const editMounted = useOpenedOnce(isEditOpen)
  useEffect(() => {
    if (!canEdit) return
    const preload = () => { void loadEntryDialog().catch(() => {}) }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload)
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(preload, 200)
    return () => window.clearTimeout(id)
  }, [canEdit])
  const importMounted = useOpenedOnce(isImportOpen)
  const deriveMounted = useOpenedOnce(isDeriveOpen)
  const generatorMounted = useOpenedOnce(isGeneratorOpen)
  const borrowMounted = useOpenedOnce(isBorrowOpen)
  const bulkAddMounted = useOpenedOnce(isBulkAddOpen)
  const findReplaceMounted = useOpenedOnce(isFindReplaceOpen)
  const shortcutsMounted = useOpenedOnce(showShortcuts)

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "n",
      metaKey: true,
      handler: () => {
        if (canEdit && !isAddOpen && !isEditOpen) {
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
        if (isBulkAddOpen) setIsBulkAddOpen(false)
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

    // replace, not push: typing a query should not add a history entry per debounce tick
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }, [pathname, router, searchParams])

  const handlePageChange = useCallback((page: number) => {
    updateUrl(page, initialQuery)
  }, [updateUrl, initialQuery])

  const handleSort = useCallback((sort: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (sort && sort !== "lemma") params.set("sort", sort)
    else params.delete("sort")
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [pathname, router, searchParams])

  const handleCreate = async (data: any) => {
    // Use JSON.parse(JSON.stringify()) to ensure a strictly plain object for the Server Action
    // Using undefined ensures JSON.stringify omits the key, which Zod expects for optional fields
    const sterilizedData = JSON.parse(JSON.stringify({
      lemma: String(data.lemma),
      gloss: String(data.gloss),
      languageId,
      ipa: data.ipa || null,
      audioUrl: data.audioUrl || null,
      partOfSpeech: data.partOfSpeech || null,
      paradigmId: data.paradigmId || null,
      etymology: data.etymology || null,
      notes: data.notes || null,
      relatedWords: data.relatedWords && data.relatedWords.length > 0 ? data.relatedWords : null,
      tags: data.tags && data.tags.length > 0 ? data.tags : null,
      linkBack: data.linkBack !== false,
    }))

    const before = createdEntryReveal.begin()
    let result: Awaited<ReturnType<typeof createDictionaryEntry>>
    try {
      result = await createDictionaryEntry(sterilizedData)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : t("unknownError") }
    }

    if ('error' in result) {
      toast.error(result.error, {
        action: {
          label: "Retry",
          onClick: () => handleCreate(data),
        },
      })
    } else {
      createdEntryReveal.settle(before, result.data.id)
      toast.success(`"${data.lemma}" added successfully`, {
        action: {
          label: "Add Another",
          onClick: () => {
            setIsAddOpen(true)
          },
        },
      })
      setIsAddOpen(false)
      // The action revalidated this route: its response already carried the
      // re-rendered page. A router.refresh() here would render everything again
      // (and an outdated service worker could answer it with a stale snapshot).
    }
  }

  const handleDeriveSubmit = async (data: any) => {
    // Use JSON.parse(JSON.stringify()) to ensure a strictly plain object for the Server Action
    const sterilizedData = JSON.parse(JSON.stringify({
      lemma: String(data.lemma),
      gloss: String(data.gloss),
      languageId,
      ipa: data.ipa || null,
      audioUrl: data.audioUrl || null,
      partOfSpeech: data.partOfSpeech || null,
      paradigmId: data.paradigmId || null,
      etymology: data.etymology || null,
      notes: data.notes || null,
      relatedWords: data.relatedWords && data.relatedWords.length > 0 ? data.relatedWords : null,
    }))

    const before = createdEntryReveal.begin()
    let result: Awaited<ReturnType<typeof createDictionaryEntry>>
    try {
      result = await createDictionaryEntry(sterilizedData)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : t("unknownError") }
    }

    if ('error' in result) {
      toast.error(result.error)
    } else {
      createdEntryReveal.settle(before, result.data.id)
      toast.success(`derived word "${data.lemma}" created`)
      setIsDeriveOpen(false)
      // The action revalidated this route: its response already carried the
      // re-rendered page. A router.refresh() here would render everything again
      // (and an outdated service worker could answer it with a stale snapshot).
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
      audioUrl: data.audioUrl || null,
      partOfSpeech: data.partOfSpeech || null,
      paradigmId: data.paradigmId || null,
      etymology: data.etymology || null,
      notes: data.notes || null,
      relatedWords: data.relatedWords && data.relatedWords.length > 0 ? data.relatedWords : null,
      // null, not undefined: JSON drops undefined keys, so removing the last tag used to be
      // silently ignored by the server (it only updates tags when the key is present).
      tags: data.tags && data.tags.length > 0 ? data.tags : null,
      linkBack: data.linkBack !== false,
    }))

    let result: Awaited<ReturnType<typeof updateDictionaryEntry>>
    try {
      result = await updateDictionaryEntry(sterilizedData)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : t("unknownError") }
    }

    if ('error' in result) {
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
      // The action revalidated this route: its response already carried the
      // re-rendered page. A router.refresh() here would render everything again
      // (and an outdated service worker could answer it with a stale snapshot).
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return

    const deletedEntry = initialEntries.find(e => e.id === deletingId)
    const entryLemma = deletedEntry?.lemma || t("entryFallback")

    let result: Awaited<ReturnType<typeof deleteDictionaryEntry>>
    try {
      result = await deleteDictionaryEntry(deletingId, languageId)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : t("unknownError") }
    }

    if ('error' in result) {
      toast.error(result.error, {
        action: {
          label: t("retry"),
          onClick: () => handleDelete(),
        },
      })
    } else {
      toast.success(t("entryDeleted", { lemma: entryLemma }), {
        action: {
          label: t("undo"),
          onClick: async () => {
            toast.info(t("undoComingSoon"))
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

      // The action revalidated this route: its response already carried the
      // re-rendered page. A router.refresh() here would render everything again
      // (and an outdated service worker could answer it with a stale snapshot).
    }
  }

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return

    const ids = Array.from(selectedEntries)
    let result: Awaited<ReturnType<typeof bulkDeleteDictionaryEntries>>
    try {
      result = await bulkDeleteDictionaryEntries(ids, languageId)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : t("unknownError") }
    }

    if ('error' in result) {
      toast.error(result.error)
    } else {
      toast.success(t("bulkDeleted", { count: result.data?.deletedCount ?? 0 }))
      setIsBulkDeleteOpen(false)
      setSelectedEntries(new Set())
      // The action revalidated this route: its response already carried the
      // re-rendered page. A router.refresh() here would render everything again
      // (and an outdated service worker could answer it with a stale snapshot).
    }
  }

  const handleDeleteAll = async () => {
    let result: Awaited<ReturnType<typeof deleteAllDictionaryEntries>>
    try {
      result = await deleteAllDictionaryEntries(languageId)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : t("unknownError") }
    }

    if ('error' in result) {
      toast.error(result.error)
    } else {
      toast.success(t("allDeleted", { count: result.data?.deletedCount ?? 0 }))
      setIsDeleteAllOpen(false)
      setSelectedEntries(new Set())
      // The action revalidated this route: its response already carried the
      // re-rendered page. A router.refresh() here would render everything again
      // (and an outdated service worker could answer it with a stale snapshot).
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

      // readJson throws NonJsonResponseError when a reverse proxy (e.g. nginx)
      // returns an HTML error page instead of the app's JSON — most commonly a
      // 413 when the upload exceeds the proxy's body-size limit.
      const result = await readJson<{
        error?: string
        imported: number
        skipped: number
        errors: number
      }>(response)

      if (!response.ok) {
        throw new Error(result.error || t("importFailed"))
      }

      toast.success(
        result.skipped > 0
          ? t("importedSkipped", { imported: result.imported, skipped: result.skipped })
          : t("importedCount", { imported: result.imported }),
        {
          description: result.errors > 0 ? t("errorsOccurred", { count: result.errors }) : undefined,
        }
      )

      setIsImportOpen(false)
      router.refresh()
    } catch (error) {
      let description: string
      if (error instanceof NonJsonResponseError) {
        description =
          error.status === 413
            ? t("importTooLarge")
            : error.status === 504
              ? t("importTimeout")
              : t("importServerError", { status: error.status })
      } else {
        description = error instanceof Error ? error.message : t("unknownError")
      }
      toast.error(t("importFailed"), { description })
    }
  }

  return (
    <div className="space-y-4">
      {/* Feature Highlight for Bulk Operations */}
      {selectedEntries.size === 0 && initialEntries.length > 0 && (
        <FeatureHighlight
          id="bulk-operations"
          title={t("bulkOpsTitle")}
          description={t("bulkOpsDesc")}
          variant="tip"
        />
      )}

      <DictionaryToolbar
        languageId={languageId}
        initialQuery={initialQuery}
        initialField={initialField}
        initialSort={initialSort}
        showLatin={showLatin}
        onShowLatinChange={setShowLatin}
        isPending={isPending}
        totalEntries={totalEntries}
        selectedCount={selectedEntries.size}
        onSearch={handleSearch}
        onSort={handleSort}
        onImport={() => setIsImportOpen(true)}
        onGenerate={() => setIsGeneratorOpen(true)}
        onBorrow={() => setIsBorrowOpen(true)}
        onBulkAdd={() => setIsBulkAddOpen(true)}
        onBulkEdit={() => setIsBulkEditOpen(true)}
        onBulkDelete={() => setIsBulkDeleteOpen(true)}
        onFindReplace={() => setIsFindReplaceOpen(true)}
        onAdd={() => setIsAddOpen(true)}
      />

      {initialEntries.length === 0 ? (
        initialQuery ? (
          <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
            <p className="text-muted-foreground">
              {t("noMatchesSearch")}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button type="button" variant="link" onClick={() => handleSearch("")}>
                {t("clearSearch")}
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setPrefillData({ gloss: initialQuery })
                    setIsAddOpen(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("addQuoted", { query: initialQuery })}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Plus}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            action={canEdit ? {
              label: t("addEntry"),
              onClick: () => setIsAddOpen(true),
            } : undefined}
          />
        )
      ) : (
        <>
          <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t("showingOf", { shown: initialEntries.length, total: totalEntries })}
            </span>
            {selectedEntries.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEntries(new Set())}
                className="h-auto p-0 hover:bg-transparent hover:text-foreground"
              >
                {t("clearSelection", { count: selectedEntries.size })}
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
              onTagClick={(tag) => handleSearch(tag, "tags")}
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
              ttsSettings={ttsSettings}
              onDerive={(entry) => {
                setDerivationSourceEntry(entry)
                setIsDeriveOpen(true)
              }}
              onTagClick={(tag) => handleSearch(tag, "tags")}
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
                {t("deleteAllN", { count: totalEntries })}
              </Button>
            </div>
          )}
        </>
      )}

      {addMounted && (
        <DictionaryEntryDialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open)
            if (!open) setPrefillData(null)
          }}
          onSubmit={handleCreate}
          isPending={isPending}
          mode="create"
          symbols={symbols}
          allowsDiacritics={allowsDiacritics}
          metadata={metadata}
          languageId={languageId}
          initialData={prefillData ? prefillData as any : undefined}
        />
      )}

      {editMounted && (
        <DictionaryEntryDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onSubmit={handleUpdate}
          initialData={editingEntry}
          isPending={isPending}
          mode="edit"
          symbols={symbols}
          allowsDiacritics={allowsDiacritics}
          metadata={metadata}
          languageId={languageId}
        />
      )}

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        isPending={isPending}
        itemName={deletingId ? initialEntries?.find(e => e.id === deletingId)?.lemma : undefined}
        description={deletingId ? t("deleteEntryDesc", { lemma: initialEntries?.find(e => e.id === deletingId)?.lemma ?? "" }) : undefined}
      />

      <DeleteConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        isPending={isPending}
        title={t("deleteBulkTitle", { count: selectedEntries.size })}
        description={t("deleteBulkDesc", { count: selectedEntries.size })}
      />

      <DeleteConfirmDialog
        open={isDeleteAllOpen}
        onOpenChange={setIsDeleteAllOpen}
        onConfirm={handleDeleteAll}
        isPending={isPending}
        title={t("deleteAllTitle", { count: totalEntries })}
        description={t("deleteAllDesc", { count: totalEntries })}
      />

      {importMounted && (
        <ImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          onImport={handleImport}
          isPending={isPending}
        />
      )}

      {deriveMounted && (
        <DerivationWizard
          open={isDeriveOpen}
          onOpenChange={setIsDeriveOpen}
          sourceEntry={derivationSourceEntry}
          languageId={languageId}
          onSubmit={handleDeriveSubmit}
          isPending={isPending}
        />
      )}

      {generatorMounted && (
        <WordGeneratorDialog
          open={isGeneratorOpen}
          onOpenChange={setIsGeneratorOpen}
          symbols={symbols}
          metadata={metadata}
          languageId={languageId}
          onAddWord={(word) => {
            setPrefillData({ lemma: word })
            setIsAddOpen(true)
          }}
        />
      )}

      {borrowMounted && (
        <BorrowWordDialog
          open={isBorrowOpen}
          onOpenChange={setIsBorrowOpen}
          languageId={languageId}
          languageName={languageName}
          onBorrow={(data) => handleCreate(data)}
        />
      )}

      {bulkAddMounted && (
        <BulkAddDialog
          open={isBulkAddOpen}
          onOpenChange={setIsBulkAddOpen}
          onSubmit={handleCreate}
          isPending={isPending}
          symbols={symbols}
        />
      )}

      {findReplaceMounted && (
        <FindReplaceDialog
          languageId={languageId}
          open={isFindReplaceOpen}
          onOpenChange={setIsFindReplaceOpen}
          onApplied={() => startTransition(() => router.refresh())}
        />
      )}

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

      {shortcutsMounted && (
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
      )}
    </div>
  )
}
