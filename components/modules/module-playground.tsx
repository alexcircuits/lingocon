"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Play } from "lucide-react"
import { ModuleFrame } from "@/components/modules/module-frame"
import { scanBundle } from "@/lib/modules/scan"

type Lang = { id: string; name: string; slug: string }

const DATA_PERMS = [
  { id: "read:dictionary", label: "Dictionary", method: "getDictionary" },
  { id: "read:phonology", label: "Phonology", method: "getPhonology" },
  { id: "read:paradigms", label: "Paradigms", method: "getParadigms" },
] as const

const EXAMPLES: { name: string; perms: string[]; code: string }[] = [
  {
    name: "Word counter",
    perms: ["read:dictionary"],
    code: `host.onInit(async function () {
  const root = document.getElementById("app");
  const { entries } = await host.request("getDictionary");
  root.innerHTML = "<h3>" + entries.length + " words</h3>";
  const ul = document.createElement("ul");
  entries.slice(0, 20).forEach(function (e) {
    const li = document.createElement("li");
    li.textContent = e.lemma + " — " + (e.gloss || "");
    ul.appendChild(li);
  });
  root.appendChild(ul);
  host.reportHeight();
});
host.ready();`,
  },
  {
    name: "Phoneme list",
    perms: ["read:phonology"],
    code: `host.onInit(async function () {
  const root = document.getElementById("app");
  const { symbols } = await host.request("getPhonology");
  root.innerHTML = "<h3>" + symbols.length + " symbols</h3>";
  const p = document.createElement("p");
  p.textContent = symbols.map(function (s) { return s.symbol + (s.ipa ? " /" + s.ipa + "/" : ""); }).join(", ");
  root.appendChild(p);
  host.reportHeight();
});
host.ready();`,
  },
]

const STARTER = `// Render into #app. Read data with host.request(method).
// Call host.ready() once, and host.reportHeight() after you draw.
host.onInit(async function (ctx) {
  const root = document.getElementById("app");
  root.textContent = "Editing " + ctx.languageSlug + "…";
  // const { entries } = await host.request("getDictionary");
  host.reportHeight();
});
host.ready();`

export function ModulePlayground({ languages }: { languages: Lang[] }) {
  const [languageId, setLanguageId] = useState(languages[0].id)
  const [code, setCode] = useState(EXAMPLES[0].code)
  const [perms, setPerms] = useState<Set<string>>(new Set(["read:dictionary"]))
  const [runKey, setRunKey] = useState(0)
  const [running, setRunning] = useState<{ code: string; key: number } | null>(null)

  const lang = languages.find((l) => l.id === languageId) ?? languages[0]

  function togglePerm(p: string) {
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  function run() {
    const scan = scanBundle(code)
    if (!scan.ok) {
      toast.error(scan.reason)
      return
    }
    const key = runKey + 1
    setRunKey(key)
    setRunning({ code, key })
  }

  function loadExample(ex: (typeof EXAMPLES)[number]) {
    setCode(ex.code)
    setPerms(new Set(ex.perms))
    setRunning(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor + controls */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Test language</Label>
            <Select value={languageId} onValueChange={setLanguageId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} className="gap-2">
            <Play className="h-4 w-4" />
            Run
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Granted permissions (simulated)</Label>
          <div className="flex flex-wrap gap-4">
            {DATA_PERMS.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={perms.has(p.id)} onCheckedChange={() => togglePerm(p.id)} />
                {p.label}
                <code className="text-[11px] text-muted-foreground">{p.method}</code>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Widget code</Label>
            <div className="flex gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.name}
                  onClick={() => loadExample(ex)}
                  className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {ex.name}
                </button>
              ))}
              <button
                onClick={() => setCode(STARTER)}
                className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Blank
              </button>
            </div>
          </div>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={20}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <Label className="text-xs">Live preview</Label>
        <Card className="min-h-[200px]">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sandboxed · {lang.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {running ? (
              <ModuleFrame
                key={running.key}
                slug="playground"
                languageId={languageId}
                languageSlug={lang.slug}
                permissions={Array.from(perms)}
                bundleCode={running.code}
                dataUrl="/api/modules/playground"
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Press <span className="font-medium text-foreground">Run</span> to execute your
                widget here.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          The preview runs in a <code>sandbox=&quot;allow-scripts&quot;</code> iframe with a strict CSP:
          no network, cookies, or storage. Data comes only through <code>host.request()</code>.
        </p>
      </div>
    </div>
  )
}
