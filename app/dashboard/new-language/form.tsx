"use client"

import { useState, useTransition } from "react"
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
}

export function CreateLanguageForm({ userLanguages = [] }: CreateLanguageFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE")
  const [parentId, setParentId] = useState<string>("none")

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
        })
      }

      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success(parentId !== "none" ? "Language evolved successfully" : "Language created successfully")
        
        if (parentId !== "none") {
          // If evolved, take them straight to sound changes to derive the daughter!
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
          <Label htmlFor="parentId" className="text-primary font-medium">Evolve from Parent Language (Optional)</Label>
          <Select
            value={parentId}
            onValueChange={setParentId}
            disabled={isPending}
          >
            <SelectTrigger id="parentId" className="bg-background">
              <SelectValue placeholder="None (Create from scratch)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Create from scratch)</SelectItem>
              {userLanguages.map(lang => (
                <SelectItem key={lang.id} value={lang.id}>{lang.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            If selected, this new daughter language will automatically inherit the parent&apos;s dictionary, script, and phonology!
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={handleNameChange}
          placeholder="My Conlang"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
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
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of your language..."
          rows={4}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
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
            <SelectItem value="PRIVATE">Private</SelectItem>
            <SelectItem value="UNLISTED">Unlisted</SelectItem>
            <SelectItem value="PUBLIC">Public</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Private: Only you can see it. Unlisted: Accessible via direct link. Public: Listed
          publicly.
        </p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Language"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

