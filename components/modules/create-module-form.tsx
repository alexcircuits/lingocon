"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createModule } from "@/app/actions/module"
import { MODULE_TYPES } from "@/lib/modules/types"
import { formatSurfaces } from "@/lib/modules/surfaces"
import { generateSlug } from "@/lib/utils/slug"
import type { ModuleType, ModuleTier } from "@prisma/client"

export function CreateModuleForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [type, setType] = useState<ModuleType>("READER_WIDGET")
  const [tier, setTier] = useState<ModuleTier>("CLIENT_SANDBOX")

  function onTypeChange(next: ModuleType) {
    setType(next)
    if (next === "TRANSFORMER" || next === "THEME") setTier("DECLARATIVE")
    else setTier("CLIENT_SANDBOX")
  }
  const [summary, setSummary] = useState("")

  function onName(v: string) {
    setName(v)
    if (!slugTouched) setSlug(generateSlug(v))
  }

  function submit() {
    startTransition(async () => {
      const res = await createModule({ name, slug, type, tier, summary: summary || undefined })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Module created")
      router.push(`/dashboard/modules/${res.data.id}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => onName(e.target.value)} placeholder="Live Conjugator" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
          placeholder="live-conjugator"
        />
        <p className="text-xs text-muted-foreground">Used in the URL: /modules/{slug || "your-slug"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={type} onValueChange={(v) => onTypeChange(v as ModuleType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULE_TYPES.map((m) => (
                <SelectItem key={m.type} value={m.type}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Applies on: {formatSurfaces(type)}</p>
        </div>
        <div className="space-y-2">
          <Label>Tier</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as ModuleTier)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DECLARATIVE">Declarative (no code)</SelectItem>
              <SelectItem value="CLIENT_SANDBOX">Client sandbox (code)</SelectItem>
              <SelectItem value="SERVER">Server / WASM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A one-line description shown on cards."
          rows={2}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        New to modules? Read the{" "}
        <Link href="/modules/docs" className="text-primary hover:underline">
          developer docs
        </Link>{" "}
        or try the{" "}
        <Link href="/dashboard/modules/playground" className="text-primary hover:underline">
          playground
        </Link>{" "}
        first.
      </p>

      <Button onClick={submit} disabled={pending || !name || !slug}>
        {pending ? "Creating…" : "Create module"}
      </Button>
    </div>
  )
}
