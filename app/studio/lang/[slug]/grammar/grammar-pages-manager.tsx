"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { ArrowUp, ArrowDown, Pencil, Trash2, BookOpen } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import type { GrammarPage } from "@prisma/client"

interface GrammarPagesManagerProps {
  languageId: string
  languageSlug: string
  pages: GrammarPage[]
  /** Map of page.id → word count, computed server-side */
  wordCountsById?: Record<string, number>
}

export function GrammarPagesManager({
  languageId,
  languageSlug,
  pages: initialPages,
  wordCountsById = {},
}: GrammarPagesManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (pageId: string) => {
    if (!confirm("Are you sure you want to delete this grammar page?")) {
      return
    }

    startTransition(async () => {
      const result = await deleteGrammarPage(pageId, languageId)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success("Grammar page deleted successfully")
        router.refresh()
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
        toast.success("Grammar page reordered successfully")
        router.refresh()
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
          title="No grammar pages yet"
          description="Create your first grammar page to start documenting grammar rules, morphology, and syntax."
          action={{
            label: "Create Grammar Page",
            href: `/studio/lang/${languageSlug}/grammar/new`,
          }}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Order</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="w-24 text-right">Words</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPages.map((page, index) => {
                  const words = wordCountsById[page.id] ?? 0
                  return (
                  <TableRow key={page.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          aria-label="Move page up"
                          onClick={() => handleReorder(page.id, "up")}
                          disabled={isPending || index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          aria-label="Move page down"
                          onClick={() => handleReorder(page.id, "down")}
                          disabled={isPending || index === initialPages.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {page.title}
                        {words === 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            empty
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
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/studio/lang/${languageSlug}/grammar/${page.slug}`}>
                          <Button variant="ghost" size="icon" aria-label="Edit page" disabled={isPending}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete page"
                          onClick={() => handleDelete(page.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
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
                      <span className="truncate font-medium">{page.title}</span>
                      {words === 0 && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          empty
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        aria-label="Move page up"
                        onClick={() => handleReorder(page.id, "up")}
                        disabled={isPending || index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        aria-label="Move page down"
                        onClick={() => handleReorder(page.id, "down")}
                        disabled={isPending || index === initialPages.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Slug</span>
                      <span className="font-mono">{page.slug}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Words</span>
                      <span className="tabular-nums">
                        {words > 0 ? words.toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Updated</span>
                      <span>{formatDate(page.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/studio/lang/${languageSlug}/grammar/${page.slug}`}
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full" aria-label="Edit page" disabled={isPending}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Delete page"
                      onClick={() => handleDelete(page.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

