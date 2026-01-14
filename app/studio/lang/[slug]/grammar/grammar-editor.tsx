"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Editor } from "@tiptap/react"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  createGrammarPage,
  updateGrammarPage,
  deleteGrammarPage,
} from "@/app/actions/grammar-page"
import { generateSlug } from "@/lib/utils/slug"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { ParadigmInsertDialog } from "@/components/paradigm-insert-dialog"
import { FileUpload } from "@/components/ui/file-upload"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Save, ArrowLeft, Trash2, AlertTriangle, Bold, Italic, List, ListOrdered, Heading1, Heading2, Table2 } from "lucide-react"
import Link from "next/link"
import type { GrammarPage } from "@prisma/client"

interface GrammarEditorProps {
  languageId: string
  languageSlug: string
  page?: GrammarPage
  order?: number
  symbols?: any[]
}

export function GrammarEditor({
  languageId,
  languageSlug,
  page,
  order = 0,
  symbols = [],
}: GrammarEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isParadigmDialogOpen, setIsParadigmDialogOpen] = useState(false)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [title, setTitle] = useState(page?.title || "")
  const [slug, setSlug] = useState(page?.slug || "")
  const [imageUrl, setImageUrl] = useState<string | null>(page?.imageUrl || null)

  const defaultContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  } as any

  const [content, setContent] = useState<any>(page?.content || defaultContent)

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    if (!page && (!slug || slug === generateSlug(title))) {
      setSlug(generateSlug(newTitle))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      if (page) {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          id: String(page.id),
          title,
          slug,
          content,
          languageId,
          imageUrl: imageUrl || undefined,
        }))

        const result = await updateGrammarPage(sterilizedData)

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          toast.success("Grammar page updated successfully")
          router.refresh()
        }
      } else {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title,
          slug,
          content,
          order,
          languageId,
          imageUrl: imageUrl || undefined,
        }))

        const result = await createGrammarPage(sterilizedData)

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          toast.success("Grammar page created successfully")
          router.push(`/studio/lang/${languageSlug}/grammar`)
        }
      }
    })
  }

  const handleDelete = async () => {
    if (!page) return

    startTransition(async () => {
      const result = await deleteGrammarPage(page.id, languageId)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Grammar page deleted")
        router.push(`/studio/lang/${languageSlug}/grammar`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/studio/lang/${languageSlug}/grammar`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Grammar
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={handleTitleChange}
                placeholder="Noun Declension"
                required
                disabled={isPending}
                maxLength={200}
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="noun-declension"
                pattern="[a-z0-9-]+"
                required
                disabled={isPending}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (lowercase letters, numbers, and hyphens only)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <FileUpload
                type="image"
                value={imageUrl || undefined}
                onChange={(url) => setImageUrl(url)}
                placeholder="Upload a cover image for this grammar page"
              />
              <p className="text-xs text-muted-foreground">
                Optional image to display with this grammar page
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <RichTextEditor
            content={content}
            onChange={setContent}
            disabled={isPending}
            withIGT
            withParadigm
            onParadigmClick={(editor) => {
              setActiveEditor(editor)
              setIsParadigmDialogOpen(true)
            }}
            withIpaChart
            symbols={symbols}
          />
        </Card>

        <div className="flex items-center justify-between">
          {page ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Page
            </Button>
          ) : (
            <div />
          )}

          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : page ? "Update Page" : "Create Page"}
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Grammar Page
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this grammar page? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParadigmInsertDialog
        open={isParadigmDialogOpen}
        onOpenChange={setIsParadigmDialogOpen}
        languageId={languageId}
        onSelect={(id, name) => {
          if (activeEditor) {
            activeEditor.chain().focus().setParadigm({ paradigmId: id, paradigmName: name }).run()
          }
        }}
      />
    </div>
  )
}

