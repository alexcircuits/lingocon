"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateLanguage, deleteLanguage } from "@/app/actions/language"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { FileUpload } from "@/components/ui/file-upload"
import { AlertTriangle, FileDown, Flag, Globe, MessageCircle, MessageSquare } from "lucide-react"

interface LanguageSettingsProps {
  language: {
    id: string
    name: string
    slug: string
    description: string | null
    visibility: string
    flagUrl: string | null
    discordUrl?: string | null
    telegramUrl?: string | null
    websiteUrl?: string | null
  }
  languageSlug: string
}

export function LanguageSettings({ language, languageSlug }: LanguageSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const [formData, setFormData] = useState({
    name: language.name,
    description: language.description || "",
    visibility: language.visibility as "PRIVATE" | "UNLISTED" | "PUBLIC",
    flagUrl: language.flagUrl || "",
    discordUrl: language.discordUrl || "",
    telegramUrl: language.telegramUrl || "",
    websiteUrl: language.websiteUrl || "",
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      // Construct a strictly plain object for the Server Action
      const updateData = {
        id: String(language.id),
        name: String(formData.name),
        visibility: formData.visibility,
        ...(formData.description ? { description: formData.description } : {}),
        ...(formData.flagUrl ? { flagUrl: formData.flagUrl } : {}),
        ...(formData.discordUrl ? { discordUrl: formData.discordUrl } : {}),
        ...(formData.telegramUrl ? { telegramUrl: formData.telegramUrl } : {}),
        ...(formData.websiteUrl ? { websiteUrl: formData.websiteUrl } : {}),
      }

      const result = await updateLanguage(updateData)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Settings updated successfully")
        router.refresh()
      }
    })
  }

  const handleDelete = async () => {
    if (deleteConfirm !== language.name) {
      setError("Language name does not match")
      return
    }

    startTransition(async () => {
      const result = await deleteLanguage(language.id)

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Language deleted successfully")
        router.push("/dashboard")
      }
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">General Settings</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isPending}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={language.slug}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Slug cannot be changed after creation
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="A brief description of your language..."
              disabled={isPending}
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Language Flag
            </Label>
            <FileUpload
              type="flag"
              value={formData.flagUrl}
              onChange={(url) => setFormData({ ...formData, flagUrl: url || "" })}
              placeholder="Upload a flag image for your language"
              maxSize={2 * 1024 * 1024}
            />
            <p className="text-xs text-muted-foreground">
              Upload a flag or emblem to represent your language. Recommended: square or flag ratio (max 2MB)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value: "PRIVATE" | "UNLISTED" | "PUBLIC") =>
                setFormData({ ...formData, visibility: value })
              }
              disabled={isPending}
            >
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIVATE">Private</SelectItem>
                <SelectItem value="UNLISTED">Unlisted</SelectItem>
                <SelectItem value="PUBLIC">Public</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Private: Only you can see it. Unlisted: Accessible via direct link.
              Public: Listed publicly.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discordUrl" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Discord Server
              </Label>
              <Input
                id="discordUrl"
                value={formData.discordUrl}
                onChange={(e) => setFormData({ ...formData, discordUrl: e.target.value })}
                placeholder="https://discord.gg/..."
                disabled={isPending}
                type="url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegramUrl" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Telegram Group
              </Label>
              <Input
                id="telegramUrl"
                value={formData.telegramUrl}
                onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
                placeholder="https://t.me/..."
                disabled={isPending}
                type="url"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </Label>
              <Input
                id="websiteUrl"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder="https://example.com"
                disabled={isPending}
                type="url"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Export</h3>
            <p className="text-sm text-muted-foreground">
              Export your language documentation as a PDF file
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(`/api/export/pdf?languageId=${language.id}`, "_blank")
            }}
            disabled={isPending}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </Card>

      <Card className="p-6 border-destructive">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-destructive mb-2">
              Danger Zone
            </h3>
            <p className="text-sm text-muted-foreground">
              Once you delete a language, there is no going back. Please be certain.
            </p>
          </div>

          <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Delete Language
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the
                  language and all associated data (alphabet, grammar pages,
                  dictionary entries).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <p className="text-sm">
                  To confirm, type the language name{" "}
                  <strong>{language.name}</strong> below:
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={language.name}
                  disabled={isPending}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteOpen(false)
                    setDeleteConfirm("")
                    setError(null)
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending || deleteConfirm !== language.name}
                >
                  {isPending ? "Deleting..." : "Delete Language"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
          >
            Delete Language
          </Button>
        </div>
      </Card>
    </div>
  )
}

