import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react"
import { MODULE_TYPES } from "@/lib/modules/types"
import { formatSurfaces } from "@/lib/modules/surfaces"
import { ModuleIcon } from "@/components/modules/module-icon"

export const metadata: Metadata = {
  title: "Building Modules — LingoCon Developer Docs",
  description:
    "How to design, build, and test modules for LingoCon: tiers, surfaces, the host SDK, permissions, and the sandbox security model.",
}

const TIER_LABEL: Record<string, string> = {
  DECLARATIVE: "Declarative (data only)",
  CLIENT_SANDBOX: "Client sandbox (JS)",
  SERVER: "Server (coming later)",
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export default function ModuleDocsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link
        href="/modules"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Marketplace
      </Link>

      <h1 className="font-serif text-3xl tracking-tight md:text-4xl">Building Modules</h1>
      <p className="mt-2 text-muted-foreground">
        Modules extend LingoCon — add studio tools, interactive widgets on public pages, sound-change
        packs, themes, and more. They&apos;re hosted by the platform, so anyone can add yours with one
        click; nobody downloads anything.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/dashboard/modules/playground">
          <Button className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Open the playground
          </Button>
        </Link>
        <Link href="/dashboard/modules/new">
          <Button variant="outline">Create a module</Button>
        </Link>
      </div>

      {/* Quick nav */}
      <nav className="mt-8 flex flex-wrap gap-2 text-sm">
        {[
          ["tiers", "Tiers"],
          ["types", "Types & surfaces"],
          ["sdk", "Host SDK"],
          ["data", "Data & permissions"],
          ["security", "Security model"],
          ["example", "Full example"],
          ["publish", "Publishing"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-12">
        <Section id="tiers" title="Three tiers">
          <p className="text-sm text-muted-foreground">
            Every module runs in one of three tiers, chosen by how much power it needs:
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <Badge variant="secondary">Declarative</Badge>{" "}
              <span className="text-muted-foreground">
                Pure data — no code runs. A sound-change rule pack or a theme palette. Zero risk,
                instant. The platform&apos;s trusted engine does the work.
              </span>
            </li>
            <li>
              <Badge variant="secondary">Client sandbox</Badge>{" "}
              <span className="text-muted-foreground">
                Your JavaScript runs inside a locked-down iframe (no network, cookies, storage, or
                DOM access to the host). It talks to LingoCon only through the host SDK. This is what
                powers reader widgets, visualizers, and studio panels.
              </span>
            </li>
            <li>
              <Badge variant="outline">Server</Badge>{" "}
              <span className="text-muted-foreground">
                Heavy/trusted compute via WASM or edge isolates. Planned for a later phase.
              </span>
            </li>
          </ul>
        </Section>

        <Section id="types" title="Types & where they apply">
          <p className="text-sm text-muted-foreground">
            Pick a type when you create a module. It determines where the module shows up:
          </p>
          <Card>
            <CardContent className="divide-y divide-border/50 p-0">
              {MODULE_TYPES.map((t) => (
                <div key={t.type} className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ModuleIcon name={t.icon} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {TIER_LABEL[t.tier] ?? t.tier}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatSurfaces(t.type)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section id="sdk" title="The host SDK">
          <p className="text-sm text-muted-foreground">
            A global <code>host</code> object is injected into every client-sandbox module. Render
            your UI into the <code>#app</code> element and use these methods:
          </p>
          <Code>{`host.ready()                       // call once, when your script has loaded
host.onInit(function (ctx) { ... }) // ctx = { languageSlug, languageId, permissions, theme }
host.request(method, params)        // returns a Promise of data (see below)
host.reportHeight()                 // re-measure after you change the DOM
host.context()                      // the init context, or null before init`}</Code>
          <p className="text-sm text-muted-foreground">
            The iframe auto-resizes to your content, but call <code>host.reportHeight()</code> after
            async renders to be safe.
          </p>
        </Section>

        <Section id="data" title="Data methods & permissions">
          <p className="text-sm text-muted-foreground">
            Read a language&apos;s data with <code>host.request()</code>. Each method requires a
            permission that the installer must grant; declare them when you publish.
          </p>
          <Card>
            <CardContent className="divide-y divide-border/50 p-0 text-sm">
              {[
                ["getLanguage", "—", "{ name, slug, description }"],
                ["getDictionary", "read:dictionary", "{ entries: [{ lemma, gloss, ipa, partOfSpeech }] }"],
                ["getPhonology", "read:phonology", "{ symbols: [{ symbol, ipa, latin, name }] }"],
                ["getParadigms", "read:paradigms", "{ paradigms: [{ id, name, slots, words }] }"],
              ].map(([m, perm, shape]) => (
                <div key={m} className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-3">
                  <code className="font-mono text-primary">{m}</code>
                  <span className="text-muted-foreground">{perm}</span>
                  <code className="font-mono text-xs text-muted-foreground sm:col-span-1">{shape}</code>
                </div>
              ))}
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            Requesting a method you didn&apos;t declare (or that wasn&apos;t granted) returns an
            error.
          </p>
        </Section>

        <Section id="security" title="Security model">
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Client-sandbox code runs in a <code>sandbox=&quot;allow-scripts&quot;</code> iframe with a
                null origin: it cannot read cookies, localStorage, or the host DOM.
              </p>
              <p>
                A strict Content-Security-Policy (<code>default-src &apos;none&apos;</code>) blocks all
                network egress — no <code>fetch</code>, XHR, WebSocket, or beacons. The only channel
                out is <code>postMessage</code> to the host.
              </p>
              <p>
                At publish time bundles are statically scanned (size limit + denylist for
                <code> document.cookie</code>, storage, <code>eval</code>, dynamic <code>import</code>,
                etc.). All language data is brokered by the host against granted permissions.
              </p>
            </div>
          </div>
        </Section>

        <Section id="example" title="Full example">
          <p className="text-sm text-muted-foreground">
            A complete reader widget that lists the 20 most recent words:
          </p>
          <Code>{`host.onInit(async function (ctx) {
  const root = document.getElementById("app");
  root.textContent = "Loading…";
  try {
    const { entries } = await host.request("getDictionary");
    root.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = ctx.languageSlug + " · " + entries.length + " words";
    root.appendChild(h);
    const ul = document.createElement("ul");
    entries.slice(0, 20).forEach(function (e) {
      const li = document.createElement("li");
      li.textContent = e.lemma + (e.ipa ? " /" + e.ipa + "/" : "") + " — " + (e.gloss || "");
      ul.appendChild(li);
    });
    root.appendChild(ul);
  } catch (err) {
    root.textContent = "Could not load data.";
  }
  host.reportHeight();
});
host.ready();`}</Code>
          <p className="text-sm text-muted-foreground">
            Paste this into the{" "}
            <Link href="/dashboard/modules/playground" className="text-primary hover:underline">
              playground
            </Link>
            , grant <code>read:dictionary</code>, and press Run.
          </p>
        </Section>

        <Section id="publish" title="Publishing">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <Link href="/dashboard/modules/new" className="text-primary hover:underline">
                Create a module
              </Link>{" "}
              and choose a type and tier.
            </li>
            <li>Prototype and test it in the playground until it works against your data.</li>
            <li>
              On the module&apos;s edit page, paste your widget code (client-sandbox) or declarative
              JSON, tick the permissions you use, and publish a version.
            </li>
            <li>
              Add it to a language (account-wide or per-language). For reader widgets and themes,
              everyone viewing that language&apos;s public page sees it.
            </li>
          </ol>
        </Section>
      </div>
    </div>
  )
}
