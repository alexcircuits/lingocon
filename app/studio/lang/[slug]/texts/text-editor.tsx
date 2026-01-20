"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createText, updateText, deleteText } from "@/app/actions/text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { ParadigmInsertDialog } from "@/components/paradigm-insert-dialog"
import { ParadigmSelector } from "@/components/paradigm-selector"
import { FileUpload } from "@/components/ui/file-upload"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Save, ArrowLeft, Trash2, AlertTriangle, Upload, FileText } from "lucide-react"
import Link from "next/link"
import { type Editor } from "@tiptap/react"

interface TextEditorProps {
  languageId: string
  languageSlug: string
  text?: {
    id: string
    title: string
    slug: string
    content: any
    coverImage?: string | null
    paradigmId?: string | null
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100)
}

export function TextEditor({ languageId, languageSlug, text }: TextEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isParadigmDialogOpen, setIsParadigmDialogOpen] = useState(false)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [uploadMode, setUploadMode] = useState<"paste" | "upload">("paste")

  // Initialize content: handle existing JSON or legacy string
  const initialContent = text?.content
    ? (typeof text.content === 'string'
      ? (() => {
        try {
          return JSON.parse(text.content)
        } catch {
          return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text.content }] }] }
        }
      })()
      : text.content)
    : { type: 'doc', content: [{ type: 'paragraph' }] }

  const [formData, setFormData] = useState({
    title: text?.title || "",
    slug: text?.slug || "",
    content: initialContent,
  })
  const [paradigmId, setParadigmId] = useState<string | null>(text?.paradigmId || null)
  const [coverImage, setCoverImage] = useState<string | null>(text?.coverImage || null)

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      title: value,
      slug: text ? prev.slug : generateSlug(value),
    }))
  }

  const handleFileUpload = useCallback(async (url: string | null, metadata?: { filename?: string }) => {
    if (!url) return

    try {
      // Fetch the file content
      const response = await fetch(url)
      const textContent = await response.text()

      // Convert plain text to Tiptap JSON structure
      const contentJson = {
        type: 'doc',
        content: textContent.split('\n\n').map(para => ({
          type: 'paragraph',
          content: para.trim() ? [{ type: 'text', text: para.trim() }] : []
        }))
      }

      setFormData((prev) => ({
        ...prev,
        content: contentJson,
        title: prev.title || metadata?.filename?.replace(/\.[^/.]+$/, "") || "Untitled",
        slug: prev.slug || generateSlug(metadata?.filename?.replace(/\.[^/.]+$/, "") || "untitled"),
      }))

      toast.success("File content loaded successfully")
    } catch (err) {
      toast.error("Failed to read file content")
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      // Helper to extract plain text for word count or other needs if necessary
      // const plainText = JSON.stringify(formData.content)

      if (text) {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          content: formData.content,
          coverImage: coverImage || undefined,
          paradigmId: paradigmId || undefined,
        }))

        const result = await updateText(String(text.id), sterilizedData)

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          toast.success("Text updated successfully")
          router.refresh()
        }
      } else {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          type: "OTHER",
          content: formData.content,
          languageId,
          coverImage: coverImage || undefined,
          paradigmId: paradigmId || undefined,
        }))
        const result = await createText(sterilizedData)

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          toast.success("Text created successfully")
          router.push(`/studio/lang/${languageSlug}/texts`)
        }
      }
    })
  }

  const handleDelete = async () => {
    if (!text) return

    startTransition(async () => {
      const result = await deleteText(text.id)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Text deleted")
        router.push(`/studio/lang/${languageSlug}/texts`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/studio/lang/${languageSlug}/texts`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Texts
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
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Enter text title..."
                required
                disabled={isPending}
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="text-slug"
                required
                disabled={isPending}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (lowercase, hyphens only)
              </p>
            </div>

            <ParadigmSelector
              languageId={languageId}
              value={paradigmId}
              onValueChange={setParadigmId}
              disabled={isPending}
            />

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <FileUpload
                type="image"
                value={coverImage || undefined}
                onChange={(url) => setCoverImage(url)}
                placeholder="Upload a cover image for this text"
              />
              <p className="text-xs text-muted-foreground">
                Optional image to display with this text
              </p>
            </div>
          </div>
        </Card>

        {!text && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label>Content Source</Label>
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    variant={uploadMode === "paste" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUploadMode("paste")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Paste Text
                  </Button>
                  <Button
                    type="button"
                    variant={uploadMode === "upload" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUploadMode("upload")}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </Button>
                </div>
              </div>

              {uploadMode === "upload" && (
                <FileUpload
                  type="file"
                  onChange={handleFileUpload}
                  placeholder="Upload a text file (.txt, .pdf, .epub)"
                  maxSize={10 * 1024 * 1024}
                />
              )}
            </div>
          </Card>
        )}

        <div className="space-y-2">
          <Label>Content</Label>
          <RichTextEditor
            content={formData.content}
            onChange={(newContent) => setFormData(prev => ({ ...prev, content: newContent }))}
            disabled={isPending}
            withParadigm
            onParadigmClick={(editor) => {
              setActiveEditor(editor)
              setIsParadigmDialogOpen(true)
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          {text ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Text
            </Button>
          ) : (
            <div />
          )}

          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : text ? "Save Changes" : "Save Text"}
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Text
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this text? This action cannot be
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
        // NOTE: We need a ref to the editor to insert paradigms properly, 
        // but for now let's assume valid selection or add a way to pass editor ref.
        // Actually, RichTextEditor handles the editor instance internally.
        // We'll simplisticly handle it or skip for now if too complex to refactor quickly.
        // Wait, RichTextEditor exposes onParadigmClick with editor instance, 
        // we can store that instance in state or just use the callback locally?
        // Ah, the dialog needs a callback to insert.
        // We need to capture the editor instance when clicking the button.
        onSelect={(id, name) => {
          if (activeEditor) {
            activeEditor.chain().focus().setParadigm({ paradigmId: id, paradigmName: name }).run()
          }
        }}
      />
    </div>
  )
}

