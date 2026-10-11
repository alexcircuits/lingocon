"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import Link from "next/link"
import {
  deleteGrammarPage,
  reorderGrammarPages,
} from "@/app/actions/grammar-page"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUp, ArrowDown, Pencil, Trash2, BookOpen, Plus } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { useStudioAccess } from "@/components/studio-access"

/** The scope every grammar create/edit/delete/reorder action requires on the server. */
const GRAMMAR_WRITE = "write:grammar"

/** The fields the list shows — not the page documents. */
export interface GrammarPageListItem {
  id: string
  title: string
  slug: string
  updatedAt: Date
}

interface GrammarPagesManagerProps {
  languageId: string
  languageSlug: string
  pages: GrammarPageListItem[]
  /** Map of page.id → word count, computed server-side */
  wordCountsById?: Record<string, number>
}

/** The list header's "New Page" button; not rendered for visitors who cannot create pages. */
export function NewGrammarPageButton({ languageSlug }: { languageSlug: string }) {
  const t = useTranslations("studio.grammar")
  const { canWrite } = useStudioAccess()
  if (!canWrite(GRAMMAR_WRITE)) return null
  return (
    <Link href={`/studio/lang/${languageSlug}/grammar/new`}>
      <Button size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        {t("newPage")}
      </Button>
    </Link>
  )
}

export function GrammarPagesManager({
  languageId,
  languageSlug,
  pages: initialPages,
  wordCountsById = {},
}: GrammarPagesManagerProps) {
  const t = useTranslations("studio.grammar")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Read-only visitors keep the list and open each page read-only (its title links there);
  // reordering, editing and deleting are not offered.
  const canEdit = useStudioAccess().canWrite(GRAMMAR_WRITE)
  const pageHref = (pageSlug: string) => `/studio/lang/${languageSlug}/grammar/${pageSlug}`

  const handleDelete = async (pageId: string) => {
    if (!confirm(t("confirmDelete"))) {
      return
    }

    startTransition(async () => {
      const result = await deleteGrammarPage(pageId, languageId)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        // No router.refresh(): the action revalidated this list, and Next re-renders it in the
        // action response.
        toast.success(t("deletedToast"))
      }
    })
  }

  const handleReorder = async (pageId: string, direction: "up" | "down") => {
    startTransition(async () => {
      const result = await reorderGrammarPages(pageId, languageId, direction)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        // No router.refresh(): the action revalidated this list (see handleDelete).
        toast.success(t("reorderedToast"))
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {initialPages.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={canEdit ? {
            label: t("createPage"),
            href: `/studio/lang/${languageSlug}/grammar/new`,
          } : undefined}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && <TableHead className="w-12">{t("order")}</TableHead>}
                  <TableHead>{t("title")}</TableHead>
                  <TableHead>{t("slug")}</TableHead>
                  <TableHead className="w-24 text-right">{t("words")}</TableHead>
                  <TableHead>{t("updated")}</TableHead>
                  {canEdit && <TableHead className="w-32">{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPages.map((page, index) => {
                  const words = wordCountsById[page.id] ?? 0
                  return (
                  <TableRow key={page.id}>
                    {canEdit && (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 sm:h-8 sm:w-8"
                            aria-label={t("moveUp")}
                            onClick={() => handleReorder(page.id, "up")}
                            disabled={isPending || index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 sm:h-8 sm:w-8"
                            aria-label={t("moveDown")}
                            onClick={() => handleReorder(page.id, "down")}
                            disabled={isPending || index === initialPages.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {canEdit ? page.title : (
                          <Link href={pageHref(page.slug)} className="hover:underline">{page.title}</Link>
                        )}
                        {words === 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {t("empty")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{page.slug}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                      {words > 0 ? words.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(page.updatedAt)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={pageHref(page.slug)}>
                            <Button variant="ghost" size="icon" aria-label={t("editPage")} disabled={isPending}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("deletePage")}
                            onClick={() => handleDelete(page.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {initialPages.map((page, index) => {
              const words = wordCountsById[page.id] ?? 0
              return (
                <Card key={page.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {canEdit ? (
                        <span className="truncate font-medium">{page.title}</span>
                      ) : (
                        <Link href={pageHref(page.slug)} className="truncate font-medium hover:underline">
                          {page.title}
                        </Link>
                      )}
                      {words === 0 && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {t("empty")}
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          aria-label={t("moveUp")}
                          onClick={() => handleReorder(page.id, "up")}
                          disabled={isPending || index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          aria-label={t("moveDown")}
                          onClick={() => handleReorder(page.id, "down")}
                          disabled={isPending || index === initialPages.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t("slug")}</span>
                      <span className="font-mono">{page.slug}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t("words")}</span>
                      <span className="tabular-nums">
                        {words > 0 ? words.toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t("updated")}</span>
                      <span>{formatDate(page.updatedAt)}</span>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={pageHref(page.slug)}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full" aria-label={t("editPage")} disabled={isPending}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("edit")}
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t("deletePage")}
                        onClick={() => handleDelete(page.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
