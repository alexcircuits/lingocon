"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { updateModule, publishVersion } from "@/app/actions/module"
import { MODULE_PERMISSIONS, PERMISSION_LABELS, type ModulePermission } from "@/lib/modules/types"
import { formatSurfaces } from "@/lib/modules/surfaces"
import type { ModuleStatus, ModuleTier, ModuleType } from "@prisma/client"

export interface EditorModule {
  id: string
  slug: string
  status: ModuleStatus
  tier: ModuleTier
  type: ModuleType
  name: string
  summary: string | null
  description: string | null
  icon: string | null
  repoUrl: string | null
  homepageUrl: string | null
  license: string | null
}

export interface EditorVersion {
  id: string
  version: string
  changelog: string | null
  yanked: boolean
  permissions: string[]
}

export function ModuleEditor({
  module: mod,
  versions,
}: {
  module: EditorModule
  versions: EditorVersion[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Details state
  const [name, setName] = useState(mod.name)
  const [summary, setSummary] = useState(mod.summary ?? "")
  const [description, setDescription] = useState(mod.description ?? "")
  const [icon, setIcon] = useState(mod.icon ?? "")
  const [repoUrl, setRepoUrl] = useState(mod.repoUrl ?? "")
  const [homepageUrl, setHomepageUrl] = useState(mod.homepageUrl ?? "")
  const [license, setLicense] = useState(mod.license ?? "")

  // Publish state
  const [version, setVersion] = useState("")
  const [changelog, setChangelog] = useState("")
  const [perms, setPerms] = useState<Set<ModulePermission>>(new Set())
  const [dataText, setDataText] = useState("")
  const [bundleCode, setBundleCode] = useState("")

  function saveDetails() {
    startTransition(async () => {
      const res = await updateModule({
        id: mod.id,
        name,
        summary: summary || undefined,
        description: description || undefined,
        icon: icon || undefined,
        repoUrl: repoUrl || "",
        homepageUrl: homepageUrl || "",
        license: license || undefined,
      })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      router.refresh()
    })
  }

  function publish() {
    let data: unknown
    if (dataText.trim()) {
      try {
        data = JSON.parse(dataText)
      } catch {
        toast.error("Declarative data must be valid JSON")
        return
      }
    }
    startTransition(async () => {
      const res = await publishVersion({
        moduleId: mod.id,
        version,
        changelog: changelog || undefined,
        permissions: Array.from(perms),
        data,
        bundleCode: bundleCode.trim() || undefined,
      })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Published v${version}`)
      setVersion("")
      setChangelog("")
      setBundleCode("")
      router.refresh()
    })
  }

  function togglePerm(p: ModulePermission) {
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Public information shown on the module page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Summary</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Description (Markdown)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Icon (Lucide name or emoji)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Sparkles" />
            </div>
            <div className="space-y-2">
              <Label>License</Label>
              <Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="MIT" />
            </div>
            <div className="space-y-2">
              <Label>Source repo URL</Label>
              <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/…" />
            </div>
            <div className="space-y-2">
              <Label>Homepage URL</Label>
              <Input value={homepageUrl} onChange={(e) => setHomepageUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <Button onClick={saveDetails} disabled={pending}>
            {pending ? "Saving…" : "Save details"}
          </Button>
        </CardContent>
      </Card>

      {/* Publish version */}
      <Card>
        <CardHeader>
          <CardTitle>Publish a version</CardTitle>
          <CardDescription>
            Versions are immutable. Publishing makes the module available in the catalog. Applies on:{" "}
            {formatSurfaces(mod.type)}. Test client code in the{" "}
            <Link href="/dashboard/modules/playground" className="text-primary hover:underline">
              playground
            </Link>{" "}
            before publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Version (semver)</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Changelog</Label>
            <Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Permissions requested</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODULE_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={perms.has(p)} onCheckedChange={() => togglePerm(p)} />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>

          {mod.tier === "DECLARATIVE" && (
            <div className="space-y-2">
              <Label>Declarative data (JSON)</Label>
              <Textarea
                value={dataText}
                onChange={(e) => setDataText(e.target.value)}
                rows={6}
                placeholder='{ "rules": "a → e / _#" }'
                className="font-mono text-xs"
              />
            </div>
          )}

          {mod.tier === "CLIENT_SANDBOX" && (
            <div className="space-y-2">
              <Label>Widget code (JavaScript)</Label>
              <p className="text-xs text-muted-foreground">
                Runs in a locked-down sandbox (no network, cookies, or storage). Render into{" "}
                <code className="rounded bg-muted px-1">#app</code> and read language data via{" "}
                <code className="rounded bg-muted px-1">host.request(&quot;getDictionary&quot;)</code>,{" "}
                <code className="rounded bg-muted px-1">getPhonology</code>, or{" "}
                <code className="rounded bg-muted px-1">getParadigms</code> inside{" "}
                <code className="rounded bg-muted px-1">host.onInit(...)</code>. Call{" "}
                <code className="rounded bg-muted px-1">host.ready()</code> when loaded. Requested
                methods must match the permissions above.
              </p>
              <Textarea
                value={bundleCode}
                onChange={(e) => setBundleCode(e.target.value)}
                rows={12}
                placeholder={
                  'host.onInit(async function () {\n  const { entries } = await host.request("getDictionary");\n  document.getElementById("app").textContent = entries.length + " words";\n  host.reportHeight();\n});\nhost.ready();'
                }
                className="font-mono text-xs"
              />
            </div>
          )}

          <Button onClick={publish} disabled={pending || !version}>
            {pending ? "Publishing…" : "Publish version"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing versions */}
      {versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {v.yanked && <Badge variant="destructive" className="text-[10px]">yanked</Badge>}
                    </div>
                    {v.changelog && <p className="text-xs text-muted-foreground">{v.changelog}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{v.permissions.length} perms</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
