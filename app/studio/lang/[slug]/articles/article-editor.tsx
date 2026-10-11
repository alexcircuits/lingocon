"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { createArticle, updateArticle, deleteArticle } from "@/app/actions/article"
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
import type { Editor, EditorEvents, JSONContent } from "@tiptap/react"
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Save, ArrowLeft, Trash2, AlertTriangle, Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Table2 } from "lucide-react"
import Link from "next/link"
import { slugOrFallback } from "@/lib/utils/slug"
import { useStudioAccess } from "@/components/studio-access"

interface ArticleEditorProps {
  languageId: string
  languageSlug: string
  /**
   * The visitor may read but not change this article (decided on the server: no write:articles,
   * and not the draft:articles author of this unpublished article). Fields are read-only and no
   * save, delete or publish control is offered.
   */
  readOnly?: boolean
  article?: {
    id: string
    title: string
    slug: string
    content: any
    coverImage?: string | null
    paradigmId?: string | null
    published?: boolean
    /** The stored revision; sent back on save so a stale tab cannot overwrite newer content. */
    updatedAt: Date | string
  }
  grammarPages?: { id: string; title: string; slug: string }[]
}

/** Preview of the server's slug policy (`articleSlug` in lib/services/article.ts): derived from the
 * title, at most 50 characters; the server may add a numeric suffix if the slug is taken. */
function previewSlug(title: string): string {
  return title.trim() ? slugOrFallback(title, "article", 50) : ""
}

/** The revision token the server compares on save (`expectedUpdatedAt`). */
function toRevision(value: Date | string | undefined): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

function initialDocument(content: unknown): JSONContent {
  if (!content) {
    return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] }
  }
  if (typeof content === "string") {
    try {
      return JSON.parse(content)
    } catch {
      return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: content }] }] }
    }
  }
  return content as JSONContent
}

export function ArticleEditor({ languageId, languageSlug, article, grammarPages = [], readOnly = false }: ArticleEditorProps) {
  const router = useRouter()
  const t = useTranslations("studio.articles")
  const tc = useTranslations("studio.common")
  // Only write:articles may publish; a draft contributor's save always stays a draft on the
  // server, so the switch is not offered to them.
  const canPublish = useStudioAccess().canWrite("write:articles") && !readOnly
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isParadigmDialogOpen, setIsParadigmDialogOpen] = useState(false)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)

  const [formData, setFormData] = useState({
    title: article?.title || "",
    slug: article?.slug || "",
  })
  const [coverImage, setCoverImage] = useState<string | null>(article?.coverImage || null)
  const [isPublished, setIsPublished] = useState(article?.published ?? false)
  // The stored revision this tab's draft is based on; adopted from every successful save.
  const [revision, setRevision] = useState(() => toRevision(article?.updatedAt))
  const [isConflict, setIsConflict] = useState(false)

  // The document lives in the editor and is read at save time, instead of being copied into
  // state (re-rendering this form) on every keystroke.
  const [initialContent] = useState(() => initialDocument(article?.content))
  const editorRef = useRef<Editor | null>(null)
  const readContent = (): JSONContent => editorRef.current?.getJSON() ?? initialContent

  // Edits not saved yet: closing or reloading the tab asks first.
  const [isDirty, setIsDirty] = useState(false)
  useUnsavedChangesWarning(isDirty)
  // Only real document edits count: TipTap also emits "update" when the editor is
  // disabled and re-enabled around every save.
  const markEdited = useCallback(({ transaction }: EditorEvents["update"]) => {
    if (transaction.docChanged) setIsDirty(true)
  }, [])

  const handleTitleChange = (value: string) => {
    setIsDirty(true)
    setFormData((prev) => ({
      ...prev,
      title: value,
      // An existing article shows its current address until a save assigns the new one.
      slug: article ? prev.slug : previewSlug(value),
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (readOnly) return
    setError(null)

    startTransition(async () => {
      if (article) {
        // JSON round-trip drops undefined keys; null is kept on purpose — it is how a removed
        // cover image is cleared on the server.
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          content: readContent(),
          coverImage: coverImage ?? null,
          published: isPublished,
          expectedUpdatedAt: revision,
        }))

        const result = await updateArticle(String(article.id), sterilizedData)

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

        const saved = result.article
        setRevision(toRevision(saved.updatedAt))
        setFormData({ title: saved.title, slug: saved.slug })
        setCoverImage(saved.coverImage ?? null)
        setIsPublished(saved.published)
        setIsConflict(false)
        setIsDirty(false)
        toast.success(t("updatedToast"))
        // The action already revalidated (and re-rendered) this route, so no refresh. Only a
        // rename that changed the slug needs navigation: the old URL no longer resolves.
        if (saved.slug !== article.slug) {
          router.replace(`/studio/lang/${languageSlug}/articles/${saved.slug}`)
        }
      } else {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          content: readContent(),
          languageId,
          coverImage: coverImage || undefined,
          published: isPublished,
        }))
        const result = await createArticle(sterilizedData)

        if ('error' in result) {
          setError(result.error ?? null)
          toast.error(result.error)
        } else {
          setIsDirty(false)
          toast.success(t("createdToast"))
          router.push(`/studio/lang/${languageSlug}/articles`)
        }
      }
    })
  }

  const handleDelete = async () => {
    if (!article) return

    startTransition(async () => {
      const result = await deleteArticle(article.id)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        setIsDirty(false)
        toast.success(t("deletedToast"))
        router.push(`/studio/lang/${languageSlug}/articles`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/studio/lang/${languageSlug}/articles`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToArticles")}
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isConflict && article && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <p>{tc("staleConflict")}</p>
          {/* A full document load: a client navigation would keep this editor's local draft. */}
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={`/studio/lang/${languageSlug}/articles/${article.slug}`}>{tc("reloadLatest")}</a>
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

            {!readOnly ? (
              <div className="space-y-2">
                <Label>{t("coverImage")}</Label>
                <FileUpload
                  type="image"
                  value={coverImage || undefined}
                  onChange={(url) => {
                    setCoverImage(url)
                    setIsDirty(true)
                  }}
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

        <Card className="overflow-hidden">
          <RichTextEditor
            content={initialContent}
            onEditorReady={(editor) => {
              editorRef.current = editor
              editor?.on("update", markEdited)
            }}
            disabled={isPending || readOnly}
            withParadigm
            onParadigmClick={(editor) => {
              setActiveEditor(editor)
              setIsParadigmDialogOpen(true)
            }}
            withWikiLinks
            languageSlug={languageSlug}
            grammarPages={grammarPages}
          />
        </Card>

        {!readOnly && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {canPublish ? (
              <label className="inline-flex min-h-11 items-center gap-3 self-start">
                <span className="text-xs text-muted-foreground">
                  {isPublished ? t("public") : t("draft")}
                </span>
                <button aria-label={t("public")}
                  type="button"
                  role="switch"
                  aria-checked={isPublished}
                  onClick={() => {
                    setIsPublished(!isPublished)
                    setIsDirty(true)
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                    isPublished ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                  disabled={isPending}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      isPublished ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            ) : (
              <span className="inline-flex min-h-11 items-center self-start text-xs text-muted-foreground">
                {isPublished ? t("public") : t("draft")}
              </span>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              {article ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsDeleteOpen(true)}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("deleteArticle")}
                </Button>
              ) : null}

              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {isPending ? t("saving") : article ? t("saveChanges") : t("saveArticle")}
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
        onSelect={(paradigmId, paradigmName) => {
          if (activeEditor) {
            activeEditor.chain().focus().setParadigm({ paradigmId, paradigmName }).run()
          }
        }}
      />
    </div>
  )
}

