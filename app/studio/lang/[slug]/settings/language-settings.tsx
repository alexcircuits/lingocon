"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateLanguage } from "@/app/actions/language"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { languageMetadataSchema } from "@/lib/validations/language"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { IPAKeyboard } from "@/components/ipa-keyboard"
import { Card } from "@/components/ui/card"
import { FileUpload } from "@/components/ui/file-upload"
import { Flag, Globe, Palette, MessageCircle, MessageSquare, Type, Volume2, Keyboard } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"
import { FlagGenerator } from "@/components/flag-generator"
import { ExportDataCard } from "./export-data-card"
import { DeleteLanguageCard } from "./delete-language-card"

type LanguageCategoryValue =
  | "CONLANG"
  | "NATURAL"
  | "ENDANGERED"
  | "RESTORED"
  | "HISTORICAL"
  | "FICTIONAL"
  | "AUXILIARY"
  | "OTHER"

interface LanguageSettingsProps {
  language: {
    id: string
    name: string
    slug: string
    description: string | null
    visibility: string
    category?: LanguageCategoryValue | string
    flagUrl: string | null
    discordUrl?: string | null
    telegramUrl?: string | null
    websiteUrl?: string | null
    fontUrl?: string | null
    fontFamily?: string | null
    fontScale: number
    allowsDiacritics?: boolean
    allowForking?: boolean
    acceptRomanizedAnswers?: boolean
    metadata?: unknown
  }
  languageSlug: string
  dictionaryEntries: {
    id: string
    lemma: string
    ipa: string | null
  }[]
  isOwner?: boolean
}

const availableVoices = [
  { id: "Joanna", name: "English (US) - Joanna (Default)" },
  { id: "Matthew", name: "English (US) - Matthew" },
  { id: "Amy", name: "English (UK) - Amy" },
  { id: "Brian", name: "English (UK) - Brian" },
  { id: "Giorgio", name: "Italian - Giorgio (Pure Vowels)" },
  { id: "Carla", name: "Italian - Carla" },
  { id: "Conchita", name: "Spanish - Conchita" },
  { id: "Enrique", name: "Spanish - Enrique" },
  { id: "Mathieu", name: "French - Mathieu" },
  { id: "Celine", name: "French - Celine" },
  { id: "Marlene", name: "German - Marlene" },
  { id: "Hans", name: "German - Hans" },
  { id: "Tatyana", name: "Russian - Tatyana" },
  { id: "Maxim", name: "Russian - Maxim" },
  { id: "Takumi", name: "Japanese - Takumi" },
  { id: "Mizuki", name: "Japanese - Mizuki" },
]

export function LanguageSettings({ language, languageSlug, dictionaryEntries, isOwner = false }: LanguageSettingsProps) {
  const t = useTranslations("studio.settings")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [previewIpa, setPreviewIpa] = useState("")


  const parsedMetadata = languageMetadataSchema.parse(language.metadata ?? {})

  const [formData, setFormData] = useState({
    name: language.name,
    slug: language.slug,
    description: language.description || "",
    visibility: language.visibility as "PRIVATE" | "UNLISTED" | "PUBLIC",
    category: (language.category as LanguageCategoryValue) || "CONLANG",
    flagUrl: language.flagUrl || "",
    discordUrl: language.discordUrl || "",
    telegramUrl: language.telegramUrl || "",
    websiteUrl: language.websiteUrl || "",
    fontUrl: language.fontUrl || "",
    fontFamily: language.fontFamily || "",
    fontScale: language.fontScale || 1.0,
    allowsDiacritics: language.allowsDiacritics ?? false,
    allowForking: language.allowForking ?? false,
    acceptRomanizedAnswers: language.acceptRomanizedAnswers ?? false,
    ttsVoice: parsedMetadata.tts?.voiceId ?? "Joanna",
    ttsSpeed: parsedMetadata.tts?.speed ?? "slow",
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      // Construct a strictly plain object for the Server Action
      const updateData = {
        id: String(language.id),
        name: String(formData.name),
        slug: String(formData.slug),
        visibility: formData.visibility,
        category: formData.category,
        description: formData.description,
        flagUrl: formData.flagUrl || null,
        discordUrl: formData.discordUrl || "",
        telegramUrl: formData.telegramUrl || "",
        websiteUrl: formData.websiteUrl ? (formData.websiteUrl.startsWith('http') ? formData.websiteUrl : `https://${formData.websiteUrl}`) : "",
        fontUrl: formData.fontUrl || null,
        fontFamily: formData.fontFamily || null,
        fontScale: Number(formData.fontScale),
        allowsDiacritics: Boolean(formData.allowsDiacritics),
        allowForking: Boolean(formData.allowForking),
        acceptRomanizedAnswers: Boolean(formData.acceptRomanizedAnswers),
        metadata: {
          ...parsedMetadata,
          tts: {
            voiceId: formData.ttsVoice,
            speed: formData.ttsSpeed,
          }
        }
      }

      const result = await updateLanguage(updateData)

      if ('error' in result) {
        setError(result.error ?? null)
        toast.error(result.error)
      } else {
        toast.success(t("savedToast"))
        if (result.slugChanged) {
          router.push(`/studio/lang/${formData.slug}/settings`)
        } else {
          router.refresh()
        }
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
            <h3 className="text-lg font-semibold mb-4">{t("generalHeading")}</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
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
            <Label htmlFor="slug">{t("slugLabel")}</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              disabled={!isOwner || isPending}
              required
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {t("slugHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("descriptionPlaceholder")}
              disabled={isPending}
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/40 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="allowsDiacritics" className="text-base font-medium">
                {t("diacriticalTitle")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("diacriticalDesc")}
              </p>
            </div>
            <Switch
              id="allowsDiacritics"
              checked={formData.allowsDiacritics}
              onCheckedChange={(checked) => setFormData({ ...formData, allowsDiacritics: checked })}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/40 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="allowForking" className="text-base font-medium">
                {t("allowForkingTitle")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("allowForkingDesc")}
              </p>
            </div>
            <Switch
              id="allowForking"
              checked={formData.allowForking}
              onCheckedChange={(checked) => setFormData({ ...formData, allowForking: checked })}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/40 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="acceptRomanizedAnswers" className="text-base font-medium">
                {t("acceptRomanizedTitle")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("acceptRomanizedDesc")}
              </p>
            </div>
            <Switch
              id="acceptRomanizedAnswers"
              checked={formData.acceptRomanizedAnswers}
              onCheckedChange={(checked) => setFormData({ ...formData, acceptRomanizedAnswers: checked })}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                {t("flagLabel")}
              </Label>
              <FlagGenerator
                languageName={language.name}
                onSave={(url) => setFormData({ ...formData, flagUrl: url })}
              />
            </div>
            <FileUpload
              type="flag"
              value={formData.flagUrl}
              onChange={(url) => setFormData({ ...formData, flagUrl: url || "" })}
              placeholder={t("flagPlaceholder")}
              maxSize={2 * 1024 * 1024}
            />
            <p className="text-xs text-muted-foreground">
              {t("flagHint")}
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <div>
              <Label className="text-base font-medium flex items-center gap-2 mb-1">
                <Type className="h-4 w-4" />
                {t("fontHeading")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("fontDesc")}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fontUpload">{t("fontFileLabel")}</Label>
                <FileUpload
                  type="font"
                  value={formData.fontUrl}
                  onChange={(url) => setFormData({ ...formData, fontUrl: url || "" })}
                  placeholder={t("fontFilePlaceholder")}
                  maxSize={15 * 1024 * 1024} // 15MB
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">{t("fontFamilyLabel")}</Label>
                  <Input
                    id="fontFamily"
                    value={formData.fontFamily}
                    onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                    placeholder={t("fontFamilyPlaceholder")}
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fontScale">{t("fontScaleLabel", { scale: formData.fontScale.toFixed(1) })}</Label>
                    <span className="text-xs text-muted-foreground">{t("fontScaleHint")}</span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <Slider
                      id="fontScale"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={[formData.fontScale]}
                      onValueChange={(vals) => setFormData({ ...formData, fontScale: vals[0] })}
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={formData.fontScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val) && val >= 0.5 && val <= 3.0) {
                          setFormData({ ...formData, fontScale: val })
                        }
                      }}
                      className="w-20"
                    />
                  </div>
                </div>

                {formData.fontUrl && (
                  <div className="space-y-2">
                    <Label>{t("fontPreviewLabel")}</Label>
                    <div className="p-4 rounded-lg border border-border/40 bg-secondary/20 overflow-hidden">
                      <style dangerouslySetInnerHTML={{
                        __html: `
                          @font-face {
                            font-family: 'PreviewFont';
                            src: url('${formData.fontUrl}');
                          }
                        `
                      }} />
                      <p
                        className="text-2xl break-all"
                        style={{
                          fontFamily: "'PreviewFont', sans-serif",
                          fontSize: `${formData.fontScale}em`
                        }}
                        contentEditable
                        suppressContentEditableWarning
                      >
                        {t("fontPreviewSample")}
                        {" "}1234567890
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("fontPreviewCaption", { scale: formData.fontScale })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <div>
              <Label className="text-base font-medium flex items-center gap-2 mb-1">
                <Volume2 className="h-4 w-4" />
                {t("ttsHeading")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("ttsDesc")}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ttsVoice">{t("ttsVoiceLabel")}</Label>
                <Select
                  value={formData.ttsVoice}
                  onValueChange={(value) => setFormData({ ...formData, ttsVoice: value })}
                  disabled={isPending}
                >
                  <SelectTrigger id="ttsVoice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ttsSpeed">{t("ttsSpeedLabel", { speed: typeof formData.ttsSpeed === 'string' && formData.ttsSpeed.endsWith('%') ? (parseInt(formData.ttsSpeed) / 100).toFixed(1) : (
                      formData.ttsSpeed === 'x-slow' ? '0.5' :
                        formData.ttsSpeed === 'slow' ? '0.7' :
                          formData.ttsSpeed === 'medium' ? '1.0' :
                            formData.ttsSpeed === 'fast' ? '1.2' :
                              formData.ttsSpeed === 'x-fast' ? '1.5' : '1.0'
                    ) })}</Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="ttsSpeed"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={[(() => {
                        if (!formData.ttsSpeed) return 1.0;
                        if (formData.ttsSpeed.endsWith('%')) return parseInt(formData.ttsSpeed) / 100;
                        switch (formData.ttsSpeed) {
                          case 'x-slow': return 0.5;
                          case 'slow': return 0.7;
                          case 'fast': return 1.2;
                          case 'x-fast': return 1.5;
                          default: return 1.0;
                        }
                      })()]}
                      onValueChange={(vals) => setFormData({ ...formData, ttsSpeed: `${Math.round(vals[0] * 100)}%` })}
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={(() => {
                        if (!formData.ttsSpeed) return 1.0;
                        if (formData.ttsSpeed.endsWith('%')) return parseInt(formData.ttsSpeed) / 100;
                        switch (formData.ttsSpeed) {
                          case 'x-slow': return 0.5;
                          case 'slow': return 0.7;
                          case 'fast': return 1.2;
                          case 'x-fast': return 1.5;
                          default: return 1.0;
                        }
                      })()}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val) && val >= 0.5 && val <= 2.0) {
                          setFormData({ ...formData, ttsSpeed: `${Math.round(val * 100)}%` })
                        }
                      }}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/40">
            <Label className="text-sm font-medium mb-3 block">{t("ttsPreviewLabel")}</Label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={t("ttsPreviewPlaceholder")}
                    value={previewIpa}
                    onChange={(e) => setPreviewIpa(e.target.value)}
                    className="font-mono flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" title={t("openIpaKeyboard")}>
                        <Keyboard className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0" align="end">
                      <IPAKeyboard
                        currentValue={previewIpa}
                        onSelect={(symbol) => setPreviewIpa((prev) => prev + symbol)}
                        onDelete={() => setPreviewIpa((prev) => prev.slice(0, -1))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("ttsPreviewHint")}
                </p>
              </div>
              <div className="flex items-start pt-1">
                <IPASpeaker
                  ipa={previewIpa}
                  voiceId={formData.ttsVoice}
                  speed={formData.ttsSpeed}
                  variant="outline"
                  className="gap-2"
                >
                  <Volume2 className="h-4 w-4" />
                  {t("ttsTest")}
                </IPASpeaker>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t("categoryLabel")}</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value as LanguageCategoryValue })
              }
              disabled={isPending}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONLANG">{t("categoryConlang")}</SelectItem>
                <SelectItem value="NATURAL">{t("categoryNatural")}</SelectItem>
                <SelectItem value="ENDANGERED">{t("categoryEndangered")}</SelectItem>
                <SelectItem value="RESTORED">{t("categoryRestored")}</SelectItem>
                <SelectItem value="HISTORICAL">{t("categoryHistorical")}</SelectItem>
                <SelectItem value="FICTIONAL">{t("categoryFictional")}</SelectItem>
                <SelectItem value="AUXILIARY">{t("categoryAuxiliary")}</SelectItem>
                <SelectItem value="OTHER">{t("categoryOther")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("categoryHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">{t("visibilityLabel")}</Label>
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
                <SelectItem value="PRIVATE">{t("visibilityPrivate")}</SelectItem>
                <SelectItem value="UNLISTED">{t("visibilityUnlisted")}</SelectItem>
                <SelectItem value="PUBLIC">{t("visibilityPublic")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("visibilityHint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discordUrl" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("discordLabel")}
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
                {t("telegramLabel")}
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
                {t("websiteLabel")}
              </Label>
              <Input
                id="websiteUrl"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder={t("websitePlaceholder")}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </Card>

      <ExportDataCard languageId={language.id} isPending={isPending} />

      {isOwner && (
        <DeleteLanguageCard languageId={language.id} languageName={language.name} />
      )}
    </div>
  )
}

