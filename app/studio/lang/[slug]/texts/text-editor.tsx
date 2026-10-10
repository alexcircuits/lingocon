"use client"

import { useRef, useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
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
import { type Editor, type JSONContent } from "@tiptap/react"
import { slugOrFallback } from "@/lib/utils/slug"

interface TextEditorProps {
  languageId: string
  languageSlug: string
  /**
   * The visitor may read but not change texts (decided on the server: no write:texts). Fields are
   * read-only and no save or delete is offered.
   */
  readOnly?: boolean
  text?: {
    id: string
    title: string
    slug: string
    content: any
    published?: boolean
    coverImage?: string | null
    paradigmId?: string | null
    /** The stored revision; sent back on save so a stale tab cannot overwrite newer content. */
    updatedAt: Date | string
  }
}

/** Preview of the server's slug policy (`textSlug` in lib/services/text.ts): derived from the
 * title, at most 50 characters; the server may add a numeric suffix if the slug is taken. */
function previewSlug(title: string): string {
  return title.trim() ? slugOrFallback(title, "text", 50) : ""
}

/** The revision token the server compares on save (`expectedUpdatedAt`). */
function toRevision(value: Date | string | undefined): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

/** Handles stored JSON, a JSON string, or a legacy plain-text string. */
function initialDocument(content: unknown): JSONContent {
  if (!content) return { type: "doc", content: [{ type: "paragraph" }] }
  if (typeof content !== "string") return content as JSONContent
  try {
    return JSON.parse(content)
  } catch {
    return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: content }] }] }
  }
}

export function TextEditor({ languageId, languageSlug, text, readOnly = false }: TextEditorProps) {
  const router = useRouter()
  const t = useTranslations("studio.texts")
  const tc = useTranslations("studio.common")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isParadigmDialogOpen, setIsParadigmDialogOpen] = useState(false)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [uploadMode, setUploadMode] = useState<"paste" | "upload">("paste")

  // The document lives in the editor and is read at save time, instead of being copied into
  // state (re-rendering this form) on every keystroke.
  const [initialContent] = useState(() => initialDocument(text?.content))
  const editorRef = useRef<Editor | null>(null)
  // An uploaded file's document, kept in case it arrives before the editor has mounted.
  const pendingContentRef = useRef<JSONContent | null>(null)
  const readContent = (): JSONContent => editorRef.current?.getJSON() ?? pendingContentRef.current ?? initialContent

  const [formData, setFormData] = useState({
    title: text?.title || "",
    slug: text?.slug || "",
  })
  const [paradigmId, setParadigmId] = useState<string | null>(text?.paradigmId || null)
  const [coverImage, setCoverImage] = useState<string | null>(text?.coverImage || null)
  // The stored revision this tab's draft is based on; adopted from every successful save.
  const [revision, setRevision] = useState(() => toRevision(text?.updatedAt))
  const [isConflict, setIsConflict] = useState(false)

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      title: value,
      // An existing text shows its current address until a save assigns the new one.
      slug: text ? prev.slug : previewSlug(value),
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

      // Show the file in the editor itself: the document is read from the editor at save time.
      pendingContentRef.current = contentJson
      editorRef.current?.commands.setContent(contentJson)
      setFormData((prev) => ({
        ...prev,
        title: prev.title || metadata?.filename?.replace(/\.[^/.]+$/, "") || "Untitled",
        slug: prev.slug || previewSlug(metadata?.filename?.replace(/\.[^/.]+$/, "") || "untitled"),
      }))

      toast.success(t("loadedToast"))
    } catch (err) {
      toast.error(t("readFailed"))
    }
  }, [t])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (readOnly) return
    setError(null)

    startTransition(async () => {
      // Helper to extract plain text for word count or other needs if necessary
      // const plainText = JSON.stringify(formData.content)

      if (text) {
        // JSON round-trip drops undefined keys; null is kept on purpose — it is how a cleared
        // paradigm or cover image is cleared on the server. `published` is not sent: saving
        // always publishes a text (see the hint next to the save button).
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          content: readContent(),
          paradigmId: paradigmId ?? null,
          coverImage: coverImage ?? null,
          expectedUpdatedAt: revision,
        }))

        const result = await updateText(String(text.id), sterilizedData)

        if ('error' in result) {
          if (result.conflict) {
            // Keep the draft on screen; saving again cannot succeed until a reload.
            setIsConflict(true)
            toast.error(tc("staleConflict"))
            return
          }
          setError(result.error ?? null)
          toast.error(result.error)
          return
        }

        const saved = result.text
        setRevision(toRevision(saved.updatedAt))
        setFormData({ title: saved.title, slug: saved.slug })
        setParadigmId(saved.paradigmId ?? null)
        setCoverImage(saved.coverImage ?? null)
        setIsConflict(false)
        toast.success(t("updatedToast"))
        // The action already revalidated (and re-rendered) this route, so no refresh. Only a
        // rename that changed the slug needs navigation: the old URL no longer resolves.
        if (saved.slug !== text.slug) {
          router.replace(`/studio/lang/${languageSlug}/texts/${saved.slug}`)
        }
      } else {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          type: "OTHER",
          content: readContent(),
          languageId,
          paradigmId: paradigmId || undefined,
        }))
        if (coverImage !== undefined) {
          sterilizedData.coverImage = coverImage
        }
        const result = await createText(sterilizedData)

        if (result.error) {
          setError(result.error ?? null)
          toast.error(result.error)
        } else {
          toast.success(t("createdToast"))
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
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(t("deletedToast"))
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
            {t("backToTexts")}
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isConflict && text && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <p>{tc("staleConflict")}</p>
          {/* A full document load: a client navigation would keep this editor's local draft. */}
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={`/studio/lang/${languageSlug}/texts/${text.slug}`}>{tc("reloadLatest")}</a>
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("titlePlaceholder")}
                required
                disabled={isPending}
                readOnly={readOnly}
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("slugLabel")}</Label>
              {/* The server derives the slug from the title and never accepted an edited one, so
                  the field shows the address instead of offering an edit it would discard. */}
              <Input
                id="slug"
                value={formData.slug}
                placeholder={t("slugPlaceholder")}
                readOnly
                aria-describedby={readOnly ? undefined : "slug-hint"}
                className="bg-muted/40 text-muted-foreground"
              />
              {!readOnly && (
                <p id="slug-hint" className="text-xs text-muted-foreground">
                  {tc("slugGeneratedHint")}
                </p>
              )}
            </div>

            <ParadigmSelector
              languageId={languageId}
              value={paradigmId}
              onValueChange={setParadigmId}
              disabled={isPending || readOnly}
            />

            {!readOnly ? (
              <div className="space-y-2">
                <Label>{t("coverImage")}</Label>
                <FileUpload
                  type="image"
                  value={coverImage || undefined}
                  onChange={(url) => setCoverImage(url)}
                  placeholder={t("coverImagePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("coverImageHint")}
                </p>
              </div>
            ) : coverImage ? (
              <div className="space-y-2">
                <Label>{t("coverImage")}</Label>
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded URL, as in FileUpload's preview */}
                <img src={coverImage} alt={t("coverImage")} className="aspect-video w-full max-w-xs rounded-xl border border-border/40 object-cover" />
              </div>
            ) : null}
          </div>
        </Card>

        {!text && !readOnly && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Label>{t("contentSource")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:ml-auto">
                  <Button
                    type="button"
                    variant={uploadMode === "paste" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUploadMode("paste")}
                    className="w-full sm:w-auto"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t("pasteText")}
                  </Button>
                  <Button
                    type="button"
                    variant={uploadMode === "upload" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUploadMode("upload")}
                    className="w-full sm:w-auto"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {t("uploadFile")}
                  </Button>
                </div>
              </div>

              {uploadMode === "upload" && (
                <FileUpload
                  type="file"
                  onChange={handleFileUpload}
                  placeholder={t("uploadPlaceholder")}
                  maxSize={10 * 1024 * 1024}
                />
              )}
            </div>
          </Card>
        )}

        <div className="space-y-2">
          <Label>{t("content")}</Label>
          <Card className="overflow-hidden">
            <RichTextEditor
              content={initialContent}
              onEditorReady={(editor) => { editorRef.current = editor }}
              disabled={isPending || readOnly}
              withParadigm
              onParadigmClick={(editor) => {
                setActiveEditor(editor)
                setIsParadigmDialogOpen(true)
              }}
            />
          </Card>
        </div>

        {!readOnly && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Saving always publishes a text (the server forces published: true), so a Draft
                switch here would be silently ignored. */}
            <p className="inline-flex min-h-11 items-center self-start text-xs text-muted-foreground">
              {t("alwaysPublishedHint")}
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              {text ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsDeleteOpen(true)}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("deleteText")}
                </Button>
              ) : null}

              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {isPending ? t("saving") : text ? t("saveChanges") : t("saveText")}
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t("deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("deleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? t("deleting") : t("delete")}
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

