"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createLanguage } from "@/app/actions/language"
import { evolveLanguage } from "@/app/actions/evolve-language"
import { generateSlug } from "@/lib/utils/slug"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
interface CreateLanguageFormProps {
  userLanguages?: { id: string; name: string }[]
  initialParentId?: string
}

export function CreateLanguageForm({ userLanguages = [], initialParentId = "none" }: CreateLanguageFormProps) {
  const t = useTranslations("createForm")
  const tWizard = useTranslations("wizard")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE")
  const [category, setCategory] = useState<
    "CONLANG" | "NATURAL" | "ENDANGERED" | "RESTORED" | "HISTORICAL" | "FICTIONAL" | "AUXILIARY" | "OTHER"
  >("CONLANG")
  const [parentId, setParentId] = useState<string>(initialParentId)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(newName))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      let result

      if (parentId !== "none") {
        result = await evolveLanguage({
          parentId,
          name,
          slug,
          description: description || undefined,
          visibility: visibility === "UNLISTED" ? "PRIVATE" : visibility,
        })
      } else {
        result = await createLanguage({
          name,
          slug,
          description: description || undefined,
          visibility: visibility as any,
          category,
        })
      }

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(parentId !== "none" ? t("evolvedToast") : t("createdToast"))

        if (parentId !== "none") {
          router.push(`/studio/lang/${slug}/sound-changes`)
        } else {
          router.push("/dashboard")
        }

        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {userLanguages.length > 0 && (
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border/50">
          <Label htmlFor="parentId" className="text-primary font-medium">{t("evolveLabel")}</Label>
          <Select
            value={parentId}
            onValueChange={setParentId}
            disabled={isPending}
          >
            <SelectTrigger id="parentId" className="bg-background">
              <SelectValue placeholder={t("noneFromScratch")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noneFromScratch")}</SelectItem>
              {userLanguages.map(lang => (
                <SelectItem key={lang.id} value={lang.id}>{lang.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{t("evolveHint")}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">{tWizard("nameLabel")}</Label>
        <Input
          id="name"
          value={name}
          onChange={handleNameChange}
          placeholder={tWizard("namePlaceholder")}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">{tWizard("slugLabel")}</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder={tWizard("slugPlaceholder")}
          pattern="[a-z0-9-]+"
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">{tWizard("slugHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{tWizard("descriptionLabel")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tWizard("descriptionPlaceholder")}
          rows={4}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{tWizard("categoryLabel")}</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as typeof category)}
          disabled={isPending}
        >
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CONLANG">{tWizard("categoryConlang")}</SelectItem>
            <SelectItem value="NATURAL">{tWizard("categoryNatural")}</SelectItem>
            <SelectItem value="ENDANGERED">{tWizard("categoryEndangered")}</SelectItem>
            <SelectItem value="RESTORED">{tWizard("categoryRestored")}</SelectItem>
            <SelectItem value="HISTORICAL">{tWizard("categoryHistorical")}</SelectItem>
            <SelectItem value="FICTIONAL">{tWizard("categoryFictional")}</SelectItem>
            <SelectItem value="AUXILIARY">{tWizard("categoryAuxiliary")}</SelectItem>
            <SelectItem value="OTHER">{tWizard("categoryOther")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{tWizard("categoryHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">{tWizard("visibilityLabel")}</Label>
        <Select
          value={visibility}
          onValueChange={(value: "PRIVATE" | "UNLISTED" | "PUBLIC") =>
            setVisibility(value)
          }
          disabled={isPending}
        >
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRIVATE">{tWizard("visibilityPrivate")}</SelectItem>
            <SelectItem value="UNLISTED">{tWizard("visibilityUnlisted")}</SelectItem>
            <SelectItem value="PUBLIC">{tWizard("visibilityPublic")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("visibilityHint")}</p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? tWizard("creating") : tWizard("createLanguage")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
