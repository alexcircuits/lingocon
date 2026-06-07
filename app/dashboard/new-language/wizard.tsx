"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createLanguage } from "@/app/actions/language"
import { createLatinAlphabet, createGrammarScaffold } from "@/app/actions/wizard"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type WizardStep = 1 | 2 | 3 | 4 | 5

interface WizardData {
  // Step 1
  name: string
  slug: string
  description: string
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC"
  // Step 2
  wordOrder?: string
  morphologicalTendency?: string
  phonologicalComplexity?: string
  // Step 3
  createAlphabet: boolean
  alphabetType?: "latin" | "custom"
  // Step 4
  createGrammarPages: boolean
}

export function LanguageWizard() {
  const t = useTranslations("wizard")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<WizardStep>(1)
  const [data, setData] = useState<WizardData>({
    name: "",
    slug: "",
    description: "",
    visibility: "PRIVATE",
    createAlphabet: false,
    createGrammarPages: false,
  })

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setData((prev) => ({
      ...prev,
      name: newName,
      slug: prev.slug || generateSlug(newName),
    }))
  }

  const handleNext = () => {
    if (step < 5) {
      setStep((s) => (s + 1) as WizardStep)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep)
    }
  }

  const handleSkip = () => {
    if (step < 5) {
      setStep((s) => (s + 1) as WizardStep)
    }
  }

  const handleFinish = () => {
    if (!data.name || !data.slug) {
      toast.error(t("errorNameSlugRequired"))
      return
    }

    startTransition(async () => {
      const metadata: Record<string, any> = {}
      if (data.wordOrder) metadata.wordOrder = data.wordOrder
      if (data.morphologicalTendency) metadata.morphologicalTendency = data.morphologicalTendency
      if (data.phonologicalComplexity) metadata.phonologicalComplexity = data.phonologicalComplexity

      const result = await createLanguage({
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        visibility: data.visibility,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      const languageId = result.data.id

      if (data.createAlphabet && data.alphabetType === "latin") {
        await createLatinAlphabet(languageId)
      }

      if (data.createGrammarPages) {
        await createGrammarScaffold(languageId)
      }

      toast.success(t("createdToast"))
      router.push(`/studio/lang/${data.slug}`)
      router.refresh()
    })
  }

  const stepDescriptions: Record<WizardStep, string> = {
    1: t("step1Desc"),
    2: t("step2Desc"),
    3: t("step3Desc"),
    4: t("step4Desc"),
    5: t("step5Desc"),
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t("title", { step })}</CardTitle>
        <CardDescription>{stepDescriptions[step]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wizard-name">{t("nameLabel")}</Label>
              <Input
                id="wizard-name"
                value={data.name}
                onChange={handleNameChange}
                placeholder={t("namePlaceholder")}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-slug">{t("slugLabel")}</Label>
              <Input
                id="wizard-slug"
                value={data.slug}
                onChange={(e) => setData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder={t("slugPlaceholder")}
                pattern="[a-z0-9-]+"
                required
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-description">{t("descriptionLabel")}</Label>
              <Textarea
                id="wizard-description"
                value={data.description}
                onChange={(e) => setData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("descriptionPlaceholder")}
                rows={4}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-visibility">{t("visibilityLabel")}</Label>
              <Select
                value={data.visibility}
                onValueChange={(value: "PRIVATE" | "UNLISTED" | "PUBLIC") =>
                  setData((prev) => ({ ...prev, visibility: value }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="wizard-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">{t("visibilityPrivate")}</SelectItem>
                  <SelectItem value="UNLISTED">{t("visibilityUnlisted")}</SelectItem>
                  <SelectItem value="PUBLIC">{t("visibilityPublic")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("typologyHint")}</p>

            <div className="space-y-2">
              <Label htmlFor="word-order">{t("wordOrderLabel")}</Label>
              <Select
                value={data.wordOrder || ""}
                onValueChange={(value) => setData((prev) => ({ ...prev, wordOrder: value }))}
                disabled={isPending}
              >
                <SelectTrigger id="word-order">
                  <SelectValue placeholder={t("wordOrderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SVO">{t("svo")}</SelectItem>
                  <SelectItem value="SOV">{t("sov")}</SelectItem>
                  <SelectItem value="VSO">{t("vso")}</SelectItem>
                  <SelectItem value="VOS">{t("vos")}</SelectItem>
                  <SelectItem value="OVS">{t("ovs")}</SelectItem>
                  <SelectItem value="OSV">{t("osv")}</SelectItem>
                  <SelectItem value="FREE">{t("freeOrder")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="morphology">{t("morphologyLabel")}</Label>
              <Select
                value={data.morphologicalTendency || ""}
                onValueChange={(value) =>
                  setData((prev) => ({ ...prev, morphologicalTendency: value }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="morphology">
                  <SelectValue placeholder={t("morphologyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="isolating">{t("isolating")}</SelectItem>
                  <SelectItem value="agglutinative">{t("agglutinative")}</SelectItem>
                  <SelectItem value="fusional">{t("fusional")}</SelectItem>
                  <SelectItem value="mixed">{t("mixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phonology">{t("phonologyComplexityLabel")}</Label>
              <Select
                value={data.phonologicalComplexity || ""}
                onValueChange={(value) =>
                  setData((prev) => ({ ...prev, phonologicalComplexity: value }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="phonology">
                  <SelectValue placeholder={t("phonologyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">{t("simple")}</SelectItem>
                  <SelectItem value="moderate">{t("moderate")}</SelectItem>
                  <SelectItem value="complex">{t("complex")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("createAlphabetQ")}</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={data.createAlphabet ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createAlphabet: true }))}
                  disabled={isPending}
                >
                  {t("yes")}
                </Button>
                <Button
                  type="button"
                  variant={!data.createAlphabet ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createAlphabet: false }))}
                  disabled={isPending}
                >
                  {t("skip")}
                </Button>
              </div>
            </div>

            {data.createAlphabet && (
              <div className="space-y-2">
                <Label htmlFor="alphabet-type">{t("alphabetTypeLabel")}</Label>
                <Select
                  value={data.alphabetType || ""}
                  onValueChange={(value: "latin" | "custom") =>
                    setData((prev) => ({ ...prev, alphabetType: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="alphabet-type">
                    <SelectValue placeholder={t("alphabetTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latin">{t("alphabetLatin")}</SelectItem>
                    <SelectItem value="custom">{t("alphabetCustom")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("alphabetHint")}</p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("createGrammarQ")}</Label>
              <p className="text-sm text-muted-foreground">{t("createGrammarHint")}</p>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={data.createGrammarPages ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createGrammarPages: true }))}
                  disabled={isPending}
                >
                  {t("yes")}
                </Button>
                <Button
                  type="button"
                  variant={!data.createGrammarPages ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createGrammarPages: false }))}
                  disabled={isPending}
                >
                  {t("skip")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold">{t("summary")}</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">{t("summaryName")}</span> {data.name}
              </div>
              <div>
                <span className="font-medium">{t("summarySlug")}</span> {data.slug}
              </div>
              {data.description && (
                <div>
                  <span className="font-medium">{t("summaryDescription")}</span> {data.description}
                </div>
              )}
              <div>
                <span className="font-medium">{t("summaryVisibility")}</span> {data.visibility}
              </div>
              {data.wordOrder && (
                <div>
                  <span className="font-medium">{t("summaryWordOrder")}</span> {data.wordOrder}
                </div>
              )}
              {data.createAlphabet && (
                <div>
                  <span className="font-medium">{t("summaryAlphabet")}</span>{" "}
                  {data.alphabetType === "latin" ? t("alphabetLatinShort") : t("alphabetCustomShort")}
                </div>
              )}
              {data.createGrammarPages && (
                <div>
                  <span className="font-medium">{t("summaryGrammar")}</span> {t("starterPagesWillBeCreated")}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
                {t("back")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 5 && (
              <>
                <Button type="button" variant="ghost" onClick={handleSkip} disabled={isPending}>
                  {t("skipStep")}
                </Button>
                <Button type="button" onClick={handleNext} disabled={isPending}>
                  {t("next")}
                </Button>
              </>
            )}
            {step === 5 && (
              <Button type="button" onClick={handleFinish} disabled={isPending || !data.name}>
                {isPending ? t("creating") : t("createLanguage")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
