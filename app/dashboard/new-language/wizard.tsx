"use client"

import { useState, useTransition } from "react"
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
      toast.error("Name and slug are required")
      return
    }

    startTransition(async () => {
      // Create language with metadata
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

      // Create alphabet if requested
      if (data.createAlphabet && data.alphabetType === "latin") {
        await createLatinAlphabet(languageId)
      }

      // Create grammar scaffold if requested
      if (data.createGrammarPages) {
        await createGrammarScaffold(languageId)
      }

      toast.success("Language created successfully")
      router.push(`/studio/lang/${data.slug}`)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Language - Step {step} of 5</CardTitle>
        <CardDescription>
          {step === 1 && "Basic information about your language"}
          {step === 2 && "Typological characteristics (optional)"}
          {step === 3 && "Script and alphabet setup (optional)"}
          {step === 4 && "Grammar documentation scaffold (optional)"}
          {step === 5 && "Review and finish"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Language Basics */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wizard-name">Name *</Label>
              <Input
                id="wizard-name"
                value={data.name}
                onChange={handleNameChange}
                placeholder="My Conlang"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-slug">Slug *</Label>
              <Input
                id="wizard-slug"
                value={data.slug}
                onChange={(e) => setData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="my-conlang"
                pattern="[a-z0-9-]+"
                required
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (lowercase letters, numbers, and hyphens only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-description">Description (optional)</Label>
              <Textarea
                id="wizard-description"
                value={data.description}
                onChange={(e) => setData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="A brief description of your language..."
                rows={4}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-visibility">Visibility</Label>
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
                  <SelectItem value="PRIVATE">Private</SelectItem>
                  <SelectItem value="UNLISTED">Unlisted</SelectItem>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Typology */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These choices help organize your language but don&apos;t restrict what you can create.
            </p>

            <div className="space-y-2">
              <Label htmlFor="word-order">Word Order (optional)</Label>
              <Select
                value={data.wordOrder || ""}
                onValueChange={(value) => setData((prev) => ({ ...prev, wordOrder: value }))}
                disabled={isPending}
              >
                <SelectTrigger id="word-order">
                  <SelectValue placeholder="Select word order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SVO">SVO (Subject-Verb-Object)</SelectItem>
                  <SelectItem value="SOV">SOV (Subject-Object-Verb)</SelectItem>
                  <SelectItem value="VSO">VSO (Verb-Subject-Object)</SelectItem>
                  <SelectItem value="VOS">VOS (Verb-Object-Subject)</SelectItem>
                  <SelectItem value="OVS">OVS (Object-Verb-Subject)</SelectItem>
                  <SelectItem value="OSV">OSV (Object-Subject-Verb)</SelectItem>
                  <SelectItem value="FREE">Free word order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="morphology">Morphological Tendency (optional)</Label>
              <Select
                value={data.morphologicalTendency || ""}
                onValueChange={(value) =>
                  setData((prev) => ({ ...prev, morphologicalTendency: value }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="morphology">
                  <SelectValue placeholder="Select tendency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="isolating">Isolating</SelectItem>
                  <SelectItem value="agglutinative">Agglutinative</SelectItem>
                  <SelectItem value="fusional">Fusional</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phonology">Phonological Complexity (optional)</Label>
              <Select
                value={data.phonologicalComplexity || ""}
                onValueChange={(value) =>
                  setData((prev) => ({ ...prev, phonologicalComplexity: value }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="phonology">
                  <SelectValue placeholder="Select complexity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="complex">Complex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 3: Script/Alphabet */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Create alphabet now?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={data.createAlphabet ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createAlphabet: true }))}
                  disabled={isPending}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!data.createAlphabet ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createAlphabet: false }))}
                  disabled={isPending}
                >
                  Skip
                </Button>
              </div>
            </div>

            {data.createAlphabet && (
              <div className="space-y-2">
                <Label htmlFor="alphabet-type">Alphabet Type</Label>
                <Select
                  value={data.alphabetType || ""}
                  onValueChange={(value: "latin" | "custom") =>
                    setData((prev) => ({ ...prev, alphabetType: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="alphabet-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latin">Latin-based (a-z pre-filled)</SelectItem>
                    <SelectItem value="custom">Custom script (create manually)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  You can always add or edit symbols later in the Studio.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Grammar Scaffold */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Create starter grammar pages?</Label>
              <p className="text-sm text-muted-foreground">
                This will create empty pages: Phonology, Nouns, Verbs, Syntax
              </p>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={data.createGrammarPages ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createGrammarPages: true }))}
                  disabled={isPending}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!data.createGrammarPages ? "default" : "outline"}
                  onClick={() => setData((prev) => ({ ...prev, createGrammarPages: false }))}
                  disabled={isPending}
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Finish */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Summary</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {data.name}
              </div>
              <div>
                <span className="font-medium">Slug:</span> {data.slug}
              </div>
              {data.description && (
                <div>
                  <span className="font-medium">Description:</span> {data.description}
                </div>
              )}
              <div>
                <span className="font-medium">Visibility:</span> {data.visibility}
              </div>
              {data.wordOrder && (
                <div>
                  <span className="font-medium">Word Order:</span> {data.wordOrder}
                </div>
              )}
              {data.createAlphabet && (
                <div>
                  <span className="font-medium">Alphabet:</span>{" "}
                  {data.alphabetType === "latin" ? "Latin-based (a-z)" : "Custom"}
                </div>
              )}
              {data.createGrammarPages && (
                <div>
                  <span className="font-medium">Grammar Pages:</span> Starter pages will be created
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-4">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 5 && (
              <>
                <Button type="button" variant="ghost" onClick={handleSkip} disabled={isPending}>
                  Skip Step
                </Button>
                <Button type="button" onClick={handleNext} disabled={isPending}>
                  Next
                </Button>
              </>
            )}
            {step === 5 && (
              <Button type="button" onClick={handleFinish} disabled={isPending || !data.name}>
                {isPending ? "Creating..." : "Create Language"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

