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
}

export function GrammarPagesManager({
  languageId,
  languageSlug,
  pages: initialPages,
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

      if (result.error) {
        setError(result.error)
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

      if (result.error) {
        setError(result.error)
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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Order</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialPages.map((page, index) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleReorder(page.id, "up")}
                        disabled={isPending || index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleReorder(page.id, "down")}
                        disabled={isPending || index === initialPages.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell className="font-mono text-sm">{page.slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(page.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/studio/lang/${languageSlug}/grammar/${page.slug}`}>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(page.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

