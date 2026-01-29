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
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { IPAKeyboard } from "@/components/ipa-keyboard"
import { Card } from "@/components/ui/card"
import { FileUpload } from "@/components/ui/file-upload"
import { AlertTriangle, FileDown, Flag, Globe, Palette, MessageCircle, MessageSquare, Type, Volume2, Keyboard } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"


import { FlagGenerator } from "@/components/flag-generator"

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
    fontUrl?: string | null
    fontFamily?: string | null
    fontScale: number
  }
  languageSlug: string
  dictionaryEntries: {
    id: string
    lemma: string
    ipa: string | null
  }[]
}

interface LanguageWithMetadata {
  id: string
  name: string
  slug: string
  description: string | null
  visibility: string
  flagUrl: string | null
  discordUrl?: string | null
  telegramUrl?: string | null
  websiteUrl?: string | null
  fontUrl?: string | null
  fontFamily?: string | null
  fontScale: number
  metadata: any
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

export function LanguageSettings({ language, languageSlug, dictionaryEntries }: LanguageSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [previewIpa, setPreviewIpa] = useState("")


  const typedLanguage = language as unknown as LanguageWithMetadata

  const [formData, setFormData] = useState({
    name: language.name,
    description: language.description || "",
    visibility: language.visibility as "PRIVATE" | "UNLISTED" | "PUBLIC",
    flagUrl: language.flagUrl || "",
    discordUrl: language.discordUrl || "",
    telegramUrl: language.telegramUrl || "",
    websiteUrl: language.websiteUrl || "",
    fontUrl: language.fontUrl || "",
    fontFamily: language.fontFamily || "",
    fontScale: language.fontScale || 1.0,
    ttsVoice: typedLanguage.metadata?.tts?.voiceId || "Joanna",
    ttsSpeed: typedLanguage.metadata?.tts?.speed || "slow",
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
        ...(formData.fontUrl ? { fontUrl: formData.fontUrl } : {}),
        ...(formData.fontFamily ? { fontFamily: formData.fontFamily } : {}),
        fontScale: Number(formData.fontScale),
        metadata: {
          ...(typedLanguage.metadata || {}),
          tts: {
            voiceId: formData.ttsVoice,
            speed: formData.ttsSpeed,
          }
        }
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
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Language Flag
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
              placeholder="Upload a flag image for your language"
              maxSize={2 * 1024 * 1024}
            />
            <p className="text-xs text-muted-foreground">
              Upload a flag or emblem to represent your language. Recommended: square or flag ratio (max 2MB)
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <div>
              <Label className="text-base font-medium flex items-center gap-2 mb-1">
                <Type className="h-4 w-4" />
                Custom Script Font
              </Label>
              <p className="text-sm text-muted-foreground">
                Upload a custom font file (.ttf, .otf, .woff, .woff2) to display your language&apos;s script correctly.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fontUpload">Font File</Label>
                <FileUpload
                  type="font"
                  value={formData.fontUrl}
                  onChange={(url) => setFormData({ ...formData, fontUrl: url || "" })}
                  placeholder="Upload font file"
                  maxSize={15 * 1024 * 1024} // 15MB
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Font Family Name (Optional)</Label>
                  <Input
                    id="fontFamily"
                    value={formData.fontFamily}
                    onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                    placeholder="e.g. MyConlangScript"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fontScale">Font Scale ({formData.fontScale.toFixed(1)}x)</Label>
                    <span className="text-xs text-muted-foreground">Adjust if font is too small/large</span>
                  </div>
                  <div className="flex items-center gap-4">
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
                    <Label>Preview</Label>
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
                        The quick brown fox jumps over the lazy dog.
                        1234567890
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Editable preview area with {formData.fontScale}x scaling
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
                Pronunciation (TTS)
              </Label>
              <p className="text-sm text-muted-foreground">
                Customize how the IPA speaker sounds. Some languages (like Italian) may handle pure vowels better than English voices.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ttsVoice">Voice</Label>
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
                    <Label htmlFor="ttsSpeed">Speed ({typeof formData.ttsSpeed === 'string' && formData.ttsSpeed.endsWith('%') ? (parseInt(formData.ttsSpeed) / 100).toFixed(1) : (
                      formData.ttsSpeed === 'x-slow' ? '0.5' :
                        formData.ttsSpeed === 'slow' ? '0.75' :
                          formData.ttsSpeed === 'medium' ? '1.0' :
                            formData.ttsSpeed === 'fast' ? '1.25' :
                              formData.ttsSpeed === 'x-fast' ? '1.5' : '1.0'
                    )}x)</Label>
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
                          case 'slow': return 0.75;
                          case 'fast': return 1.25;
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
                          case 'slow': return 0.75;
                          case 'fast': return 1.25;
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
            <Label className="text-sm font-medium mb-3 block">Preview Voice</Label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter IPA to preview..."
                    value={previewIpa}
                    onChange={(e) => setPreviewIpa(e.target.value)}
                    className="font-mono flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" title="Open IPA Keyboard">
                        <Keyboard className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <IPAKeyboard
                        currentValue={previewIpa}
                        onSelect={(symbol) => setPreviewIpa((prev) => prev + symbol)}
                        onDelete={() => setPreviewIpa((prev) => prev.slice(0, -1))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-muted-foreground">
                  Type IPA directly or use the keyboard to test the voice.
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
                  Test
                </IPASpeaker>
              </div>
            </div>
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
            <h3 className="text-lg font-semibold mb-2">Export Data</h3>
            <p className="text-sm text-muted-foreground">
              Download your language data in various formats.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* PDF export temporarily disabled - needs font/rendering fixes
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.open(`/api/export/pdf?languageId=${language.id}`, "_blank")
              }}
              disabled={isPending}
              className="h-auto py-4 flex flex-col gap-2 items-center text-center"
            >
              <FileDown className="h-6 w-6" />
              <span>PDF Documentation</span>
              <span className="text-xs text-muted-foreground font-normal">Complete Reference</span>
            </Button>
            */}


            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.open(`/api/export/docx?languageId=${language.id}`, "_blank")
              }}
              disabled={isPending}
              className="h-auto py-4 flex flex-col gap-2 items-center text-center"
            >
              <FileDown className="h-6 w-6" />
              <span>Google Docs / Word</span>
              <span className="text-xs text-muted-foreground font-normal">Editable Document</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.open(`/api/export/xlsx?languageId=${language.id}`, "_blank")
              }}
              disabled={isPending}
              className="h-auto py-4 flex flex-col gap-2 items-center text-center"
            >
              <FileDown className="h-6 w-6" />
              <span>Excel Spreadsheet</span>
              <span className="text-xs text-muted-foreground font-normal">Multi-sheet Workbook</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.open(`/api/export/csv?languageId=${language.id}`, "_blank")
              }}
              disabled={isPending}
              className="h-auto py-4 flex flex-col gap-2 items-center text-center"
            >
              <FileDown className="h-6 w-6" />
              <span>CSV (Dictionary)</span>
              <span className="text-xs text-muted-foreground font-normal">Spreadsheet Compatible</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.open(`/api/export/json?languageId=${language.id}`, "_blank")
              }}
              disabled={isPending}
              className="h-auto py-4 flex flex-col gap-2 items-center text-center"
            >
              <FileDown className="h-6 w-6" />
              <span>JSON Data</span>
              <span className="text-xs text-muted-foreground font-normal">Raw Database Export</span>
            </Button>
          </div>
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
    </div >
  )
}

