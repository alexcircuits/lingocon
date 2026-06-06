"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Loader2 } from "lucide-react"
import { createCourse } from "@/app/actions/learn"
import { toast } from "sonner"

export function CreateCourseDialog({ languageId, slug }: { languageId: string; slug: string }) {
  const t = useTranslations("studio.courses")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const result = await createCourse(languageId, title.trim(), description.trim() || undefined)
      if (result.data) {
        toast.success(t("createdToast"))
        setOpen(false)
        setTitle("")
        setDescription("")
        router.push(`/studio/lang/${slug}/courses/${result.data.id}`)
      }
    } catch {
      toast.error(t("createFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("newCourse")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("createCourseTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">{t("courseTitle")}</Label>
            <Input
              id="course-title"
              placeholder={t("titlePlaceholder")}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-desc">{t("description")} <span className="text-muted-foreground">{t("descriptionOptional")}</span></Label>
            <Textarea
              id="course-desc"
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={loading || !title.trim()} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
