"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { Editor, JSONContent } from "@tiptap/react"
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
import type { GrammarPage, ScriptSymbol } from "@prisma/client"

interface GrammarEditorProps {
  languageId: string
  languageSlug: string
  page?: GrammarPage
  order?: number
  symbols?: Pick<ScriptSymbol, "id" | "symbol" | "ipa" | "latin" | "name" | "order">[]
  grammarPages?: { id: string; title: string; slug: string }[]
}

export function GrammarEditor({
  languageId,
  languageSlug,
  page,
  order = 0,
  symbols = [],
  grammarPages = [],
}: GrammarEditorProps) {
  const router = useRouter()
  const t = useTranslations("studio.grammar")
  const tc = useTranslations("studio.common")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isParadigmDialogOpen, setIsParadigmDialogOpen] = useState(false)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null)
  const [title, setTitle] = useState(page?.title || "")
  const [slug, setSlug] = useState(page?.slug || "")
  const [imageUrl, setImageUrl] = useState<string | null>(page?.imageUrl || null)

  const defaultContent: JSONContent = {
    type: "doc",
    content: [{ type: "paragraph" }],
  }

  const [content, setContent] = useState<JSONContent>(
    (page?.content as JSONContent | null) ?? defaultContent
  )

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
          title,
          slug,
          content,
          order,
          languageId,
          imageUrl: imageUrl || undefined,
        }))

        const result = await createGrammarPage(sterilizedData)

        if ('error' in result) {
          setError(result.error ?? null)
          toast.error(result.error)
        } else {
          toast.success(t("createdToast"))
          router.push(`/studio/lang/${languageSlug}/grammar`)
        }
      }
    })
  }

  const handleDelete = async () => {
    if (!page) return

    startTransition(async () => {
      const result = await deleteGrammarPage(page.id, languageId)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(t("deletedShortToast"))
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
            {t("backToGrammar")}
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
              <Label htmlFor="title">{t("title")}</Label>
              <Input
                id="title"
                value={title}
                onChange={handleTitleChange}
                placeholder={t("titlePlaceholder")}
                required
                disabled={isPending}
                maxLength={200}
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("slug")}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t("slugPlaceholder")}
                pattern="[a-z0-9-]+"
                required
                disabled={isPending}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {t("slugHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("coverImage")}</Label>
              <FileUpload
                type="image"
                value={imageUrl || undefined}
                onChange={(url) => setImageUrl(url)}
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
            withIGT
            withParadigm
            onParadigmClick={(editor) => {
              setActiveEditor(editor)
              setIsParadigmDialogOpen(true)
            }}
            withIpaChart
            symbols={symbols}
            withWikiLinks
            languageSlug={languageSlug}
            grammarPages={grammarPages}
          />
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {page ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("deletePage")}
            </Button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {isPending ? tc("saving") : page ? t("updatePage") : t("createPage")}
          </Button>
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
              {t("deleteConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? t("deleting") : tc("delete")}
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

