"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Download, Upload, Edit, Plus, Trash2, Sparkles, Languages, Table2, ArrowUpDown, MoreHorizontal,
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TransliterationToggle } from "@/components/transliteration-toggle"
import { ContextualHelp } from "@/components/contextual-help"
import { DictionarySearch } from "./dictionary-search"

interface DictionaryToolbarProps {
  languageId: string
  initialQuery: string
  initialField: string
  initialSort: string
  showLatin: boolean
  onShowLatinChange: (value: boolean) => void
  isPending: boolean
  totalEntries: number
  selectedCount: number
  onSearch: (query: string, field?: string) => void
  onSort: (sort: string) => void
  onImport: () => void
  onGenerate: () => void
  onBorrow: () => void
  onBulkAdd: () => void
  onBulkEdit: () => void
  onBulkDelete: () => void
  onAdd: () => void
}

/** Search + sort + import/export/generate/borrow controls for the dictionary manager. */
export function DictionaryToolbar({
  languageId,
  initialQuery,
  initialField,
  initialSort,
  showLatin,
  onShowLatinChange,
  isPending,
  totalEntries,
  selectedCount,
  onSearch,
  onSort,
  onImport,
  onGenerate,
  onBorrow,
  onBulkAdd,
  onBulkEdit,
  onBulkDelete,
  onAdd,
}: DictionaryToolbarProps) {
  const t = useTranslations("studio.dictionary")

  function handleExport() {
    const url = `/api/export/csv?languageId=${languageId}`
    window.open(url, "_blank")
    toast.success(t("exportSuccess"))
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-4">
      <div className="flex-1 w-full">
        <DictionarySearch
          onSearch={onSearch}
          defaultValue={initialQuery}
          defaultField={initialField}
        />
      </div>

      <div className="hidden sm:flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <Select defaultValue={initialSort} onValueChange={onSort}>
          <SelectTrigger className="h-9 w-[140px] sm:w-[160px] gap-1 text-sm">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={t("sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lemma">{t("sortLemma")}</SelectItem>
            <SelectItem value="gloss">{t("sortGloss")}</SelectItem>
            <SelectItem value="createdAt">{t("sortNewest")}</SelectItem>
            <SelectItem value="partOfSpeech">{t("sortPos")}</SelectItem>
          </SelectContent>
        </Select>

        <TransliterationToggle
          onToggle={onShowLatinChange}
          defaultShowLatin={showLatin}
        />

        <Button
          variant="outline"
          size="icon"
          onClick={handleExport}
          disabled={isPending || totalEntries === 0}
          title={t("exportCsv")}
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onImport}
          disabled={isPending}
          title={t("importCsv")}
        >
          <Upload className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onGenerate}
          disabled={isPending}
          title={t("generateWords")}
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onBorrow}
          disabled={isPending}
          title={t("borrowWord")}
        >
          <Languages className="h-4 w-4" />
        </Button>

        <ContextualHelp
          content={t("shortcutHelp")}
          shortcut="⌘N"
        />

        {selectedCount > 0 && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={onBulkEdit}
              disabled={isPending}
              title={t("bulkEdit", { count: selectedCount })}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onBulkDelete}
              disabled={isPending}
              title={t("deleteSelected", { count: selectedCount })}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onBulkAdd}
          className="gap-2 shrink-0"
          title={t("bulkAddEntries")}
        >
          <Table2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t("bulkAdd")}</span>
        </Button>

        <Button type="button" onClick={onAdd} className="gap-2 shrink-0 ml-auto sm:ml-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("addEntry")}</span>
        </Button>
      </div>

      {/* Mobile condensed controls: Sort + primary Add + collapsed "More" menu */}
      <div className="flex sm:hidden flex-wrap items-center gap-2 w-full">
        <Select defaultValue={initialSort} onValueChange={onSort}>
          <SelectTrigger className="h-9 w-[140px] gap-1 text-sm">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={t("sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lemma">{t("sortLemma")}</SelectItem>
            <SelectItem value="gloss">{t("sortGloss")}</SelectItem>
            <SelectItem value="createdAt">{t("sortNewest")}</SelectItem>
            <SelectItem value="partOfSpeech">{t("sortPos")}</SelectItem>
          </SelectContent>
        </Select>

        <TransliterationToggle
          onToggle={onShowLatinChange}
          defaultShowLatin={showLatin}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" title={t("moreActions")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExport} disabled={isPending || totalEntries === 0}>
              <Download className="h-4 w-4" />
              {t("exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport} disabled={isPending}>
              <Upload className="h-4 w-4" />
              {t("importCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGenerate} disabled={isPending}>
              <Sparkles className="h-4 w-4" />
              {t("generateWords")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBorrow} disabled={isPending}>
              <Languages className="h-4 w-4" />
              {t("borrowWord")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBulkAdd}>
              <Table2 className="h-4 w-4" />
              {t("bulkAdd")}
            </DropdownMenuItem>
            {selectedCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onBulkEdit} disabled={isPending}>
                  <Edit className="h-4 w-4" />
                  {t("bulkEdit", { count: selectedCount })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onBulkDelete}
                  disabled={isPending}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("deleteSelected", { count: selectedCount })}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button type="button" onClick={onAdd} className="gap-2 shrink-0 ml-auto">
          <Plus className="h-4 w-4" />
          {t("addEntry")}
        </Button>
      </div>
    </div>
  )
}
