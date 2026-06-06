"use client"

import { useState, useTransition } from "react"
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
import type { Editor } from "@tiptap/react"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Save, ArrowLeft, Trash2, AlertTriangle, Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Table2 } from "lucide-react"
import Link from "next/link"

interface ArticleEditorProps {
  languageId: string
  languageSlug: string
  article?: {
    id: string
    title: string
    slug: string
    content: any
    coverImage?: string | null
    paradigmId?: string | null
    published?: boolean
  }
  grammarPages?: { id: string; title: string; slug: string }[]
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100)
}

export function ArticleEditor({ languageId, languageSlug, article, grammarPages = [] }: ArticleEditorProps) {
  const router = useRouter()
  const t = useTranslations("studio.articles")
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

  const [content, setContent] = useState<any>(() => {
    if (!article?.content) {
      return {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
      }
    }

    if (typeof article.content === 'string') {
      try {
        return JSON.parse(article.content)
      } catch {
        return {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: article.content }] }]
        }
      }
    }

    return article.content
  })

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      title: value,
      slug: article ? prev.slug : generateSlug(value),
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      if (article) {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          content: content,
          coverImage: coverImage || undefined,
          published: isPublished,
        }))

        const result = await updateArticle(String(article.id), sterilizedData)

        if ('error' in result) {
          setError(result.error ?? null)
          toast.error(result.error)
        } else {
          toast.success(t("updatedToast"))
          router.refresh()
        }
      } else {
        // Use JSON.parse(JSON.stringify()) with undefined to ensure optional keys are omitted
        const sterilizedData = JSON.parse(JSON.stringify({
          title: formData.title,
          content: content,
          languageId,
          coverImage: coverImage || undefined,
          published: isPublished,
        }))
        const result = await createArticle(sterilizedData)

        if ('error' in result) {
          setError(result.error ?? null)
          toast.error(result.error)
        } else {
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
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("slugLabel")}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder={t("slugPlaceholder")}
                required
                disabled={isPending}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
              <p className="text-xs text-muted-foreground">
                {t("slugHint")}
              </p>
            </div>

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

          </div>
        </Card>

        <Card className="overflow-hidden">
          <RichTextEditor
            content={content}
            onChange={setContent}
            disabled={isPending}
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex min-h-11 items-center gap-3 self-start">
            <span className="text-xs text-muted-foreground">
              {isPublished ? t("public") : t("draft")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={() => setIsPublished(!isPublished)}
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

