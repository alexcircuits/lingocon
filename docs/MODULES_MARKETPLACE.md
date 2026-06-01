# Modules — a community module marketplace for LingoCon

> **Status:** Phase 0 implementation in progress (data model + catalog + dynamic studio nav).
> The runtime/sandbox tiers (1–2) remain design-only for now.
>
> **Scope decisions captured from planning:**
> - Name: the unit is a **Module**; the marketplace lives at **`/modules`**.
> - Execution model: **Tier 0 (declarative packs) first, then Tier 1 (sandboxed client code).**
> - First code category to nail: **UI modules — studio panels & reader widgets.**
> - Monetization: **Free + open only** (optional author tipping). No paid modules.
> - **Distribution: hosted & instant.** Every module is hosted by the platform; users never
>   download or install anything locally — they click **Add** and it runs in-app immediately.
> - **Control: owner-only on public pages.** Only a language's owner/editors choose which modules
>   appear on its public page; every visitor sees the same set.
> - **Reader virality loop:** public visitors can use reader modules without an account, and
>   (when logged in) can one-click **add the same module onto their own languages**.
> - **Scope: per-language *and* account-wide**, chosen at add time.

This document lives in `docs/` but is intentionally **not** registered in `lib/docs/site-docs.ts`,
because it is an internal design spec rather than end-user-facing documentation.

---

## 1. Summary

Let conlangers extend LingoCon with shareable add-ons — **Modules** — and build a marketplace at
`/modules` to discover, add, rate, and version them. A creator could publish a "Proto-Germanic
sound-change pack," an "Anki deck exporter," a "syntax-tree content block," or a "live conjugator
widget," and have other users add it to their languages in one click.

The codebase already contains three "proto-modules" that prove the model:

- **Sound-change engine** — `lib/utils/sound-change.ts` + `app/actions/apply-sound-changes.ts`
  (a pure `text → text` rule DSL).
- **Word generator** — `lib/utils/word-generator.ts`.
- **TipTap content blocks** — `lib/tiptap/*` (paradigm, IGT, wiki-link, custom-font).

The Modules marketplace generalizes these into a first-class, community-extensible platform.

**Everything is hosted and instant.** There is no "download," no `npm install`, and no local files
for the people who *use* modules. The platform stores each published bundle and serves it directly
into the sandbox at runtime. Adding a module is a single click that takes effect immediately.
(Authors still *build and publish* a bundle — see §8 — but consumers never touch a build step.)

---

## 2. Why this fits the existing architecture

| Surface | Where it lives today | Role in Modules |
|---|---|---|
| Studio nav tabs | `app/studio/lang/studio-layout.tsx` (hard-coded `tabs` array) | Injection point for **studio-panel** modules (dynamic tabs) |
| Public reader | `app/lang/[slug]/...`, `nav-bento` | Injection point for **reader-widget** modules |
| TipTap extensions | `lib/tiptap/*` | Pattern for **content-block** modules |
| Sound-change / word generators | `lib/utils/*` | First **transformer / generator** modules to dogfood |
| Export service | `lib/services/export-service.ts`, `app/api/export/*` | **Exporter** module surface |
| Auth / permissions | `lib/auth-helpers.ts` (`canEditLanguage`, `canViewLanguage`) | The gate every module data-access must reuse |
| JSON content fields | `Language.metadata`, `Paradigm.slots`, TipTap `content` | Where module config/output is stored, consistent with current patterns |

Server Actions + `ActionResult<T>` + `revalidatePath` remain the mutation pipeline; modules never
bypass it.

---

## 3. Module categories

Each category is grounded in an existing feature so v1 ships with real, dogfoodable examples.
**Bold** entries are prioritized first per the scope decision.

1. **Studio panels** — a new left-nav tab + page inside the studio (e.g. "Phonotactics checker",
   "Conlang relay", "Gloss helper"). **[priority]**
2. **Reader widgets** — embeddable blocks on the public language page (e.g. live conjugator,
   number converter, "word of the day"). **[priority]**
3. Content blocks — new TipTap nodes for grammar/articles (syntax trees, phoneme charts).
   (Dogfood: IGT / paradigm extensions.)
4. Transformers — `text → text` over the lexicon (sound-change packs, romanizers,
   transliterators, orthography converters). (Dogfood: `sound-change.ts`.)
5. Generators — produce data from rules (word/name/number/sentence generators).
   (Dogfood: `word-generator.ts`.)
6. Importers / Exporters — Anki, CSV, LaTeX, PDF, JSON; ConWorkShop / PolyGlot import;
   Swadesh seeding. (Dogfood: `export-service.ts`.)
7. Visualizers — charts/diagrams over a language's data (vowel-space chart, family-tree
   renderer, frequency stats).
8. Validators / linters — consistency checks (phonotactic violations, missing glosses,
   duplicate lemmas).
9. Themes & fonts (declarative, no code) — palettes + typography + script fonts for a
   language's public page.

These map to the `ModuleType` enum: `STUDIO_PANEL`, `READER_WIDGET`, `CONTENT_BLOCK`,
`TRANSFORMER`, `GENERATOR`, `EXPORTER`, `IMPORTER`, `VISUALIZER`, `VALIDATOR`, `THEME`.

---

## 4. Execution model

The hardest question is **how untrusted, community-authored code runs**. We adopt a **tiered**
model and ship the safest tiers first.

### Tier 0 — Declarative packs (no code) — *ship first*

Modules that are pure data validated against a schema: sound-change rule packs, phoneme
inventories, themes, templates, word lists. **Zero code execution → zero sandbox risk.** The
sound-change engine already interprets such data; we make rule sets addable and shareable. This is
the fastest path to a real marketplace.

### Tier 1 — Sandboxed client modules — *the heart of the marketplace*

Author-written JS/TS modules that run **only in the browser, inside a locked-down sandbox** and
never touch the DOM, network, database, cookies, or session directly. They talk to the host through
a **typed, capability-gated message bridge**.

- **UI modules** (studio panels / reader widgets / content blocks) → render in a **sandboxed
  cross-origin `<iframe>`** (`sandbox="allow-scripts"`, strict CSP, no same-origin access) and
  communicate via `postMessage`. The host renders the chrome; the module renders inside its frame.
  **This is the first code category we build**, per the scope decision.
- **Compute modules** (generators / transformers / validators / exporters) → run in a **Web
  Worker** with no network. Deterministic `input → output`. (Note: the Worker sandbox is
  technically simpler than the iframe UI sandbox; we still prioritize the iframe path because UI
  modules are the chosen first target, and reuse the same bridge for compute right after.)

This gives us **real code** with **browser-grade isolation** and **no server compute cost or RCE
surface** — covering the large majority of useful conlang tools.

### Tier 2 — Server-side / WASM — *future, reserved*

For heavy or trusted compute (large corpus processing, ML transliteration): run as **WASM**
(wasmtime / `isolated-vm`) or on edge isolates, gated to verified authors. Out of scope for v1; we
reserve the manifest fields now so we don't paint ourselves into a corner.

### Distribution: hosted & instant (zero-install for users)

This model is deliberately "global" — modules live on the platform, not on the user's machine:

- **Hosted bundles.** When an author publishes a version, the immutable bundle is stored by the
  platform (object storage; `ModuleVersion.bundleUrl` + `bundleHash`). At runtime the host loads it
  straight into the sandbox. Nothing is downloaded to the user's device beyond the normal page
  assets the browser already fetches.
- **One-click Add = instant activate.** "Adding" a module creates a `ModuleInstall` row and the
  module is immediately live in its declared slots — no restart, no build, no file handling.
- **Official modules can be ambient.** Trusted/official modules may be available everywhere by
  default (still toggleable), so the most useful tools feel built-in rather than added.
- **Authors vs. consumers.** Only *authors* build a bundle and publish a version (§8). Everyone
  *else* simply clicks Add. The build/CLI/dev-mode tooling in §8 is exclusively an author concern.

---

## 5. The SDK and host bridge

A published package **`@lingocon/module-sdk`** defines the contract. The module imports typed APIs;
at runtime those calls are proxied over `postMessage` to the host, which enforces permissions and
reuses `lib/auth-helpers.ts`.

```ts
// Illustrative — a reader-widget module
import { defineModule } from "@lingocon/module-sdk"

export default defineModule({
  id: "com.example.conjugator",
  type: "reader-widget",
  contributes: { readerWidget: { title: "Conjugator", placement: "sidebar" } },
  async render(ctx) {
    const paradigms = await ctx.paradigms.list()   // requires "read:paradigms"
    ctx.ui.render(<Conjugator paradigms={paradigms} />)
  },
})
```

**Host context (`ctx`) is the only way out of the sandbox.** Everything is namespaced and
permissioned:

- `ctx.dictionary`, `ctx.phonology`, `ctx.paradigms`, `ctx.grammar`, `ctx.texts` — **read** APIs
  return scoped, serialized data; **write** APIs route through *existing Server Actions* so
  `canEditLanguage` still gates every write and changes land in the `Activity` / `AuditLog` tables
  for free.
- `ctx.ui` — host-provided primitives (button, table, form, chart) so iframe UIs match the design
  system and cannot break out of their frame.
- `ctx.storage` — module-scoped key/value (per language or per user), size-capped.
- `ctx.net.fetch(url)` — **only if `net:fetch` granted**; routed through a server-side proxy with a
  domain allowlist (prevents SSRF, hides the user's IP, enables rate-limiting and logging).
- `ctx.export.emit(file)` — exporters hand bytes back to the host download flow.

### Manifest — `module.json`

```json
{
  "id": "com.example.conjugator",
  "name": "Live Conjugator",
  "version": "1.2.0",
  "sdk": "^1.0.0",
  "type": "reader-widget",
  "author": { "userId": "...", "name": "..." },
  "license": "MIT",
  "sourceUrl": "https://github.com/...",
  "contributes": {
    "readerWidget": { "title": "Conjugator", "placement": "sidebar" }
  },
  "permissions": ["read:paradigms", "read:dictionary", "storage"],
  "settingsSchema": { "...": "JSON Schema for user-configurable options" },
  "entry": "dist/index.js"
}
```

### Capabilities

Declared in the manifest, granted by the user at add time, shown in plain language:

`read:dictionary|phonology|paradigms|grammar|texts`, `write:dictionary|...`,
`ui:studio-panel|reader-widget|content-block`, `net:fetch` (+ allowlist), `storage`, `export`.

Least-privilege by default; the consent UI explains exactly what each grant means.

### SDK versioning

The SDK is versioned with semver. Each manifest declares an `sdk` range; the host refuses to load
modules outside the supported range. **A stable contract is mandatory from day one** — without it,
every host change breaks modules.

---

## 6. Data model (Prisma additions)

Following existing conventions (cuid ids, `@@map`, indexes, cascade rules):

- **`Module`** — `id`, `slug` (unique), `name`, `summary`, `description`, `type` (`ModuleType`),
  `tier` (`ModuleTier`), `authorId → User`, `status` (`ModuleStatus`: `DRAFT | IN_REVIEW |
  PUBLISHED | SUSPENDED | DEPRECATED`), `isOfficial`, `isVerifiedAuthor`, `icon`, `repoUrl`,
  `homepageUrl`, `license`, `tags` (Json), `addCount`, `ratingSum`, `ratingCount`, timestamps.
- **`ModuleVersion`** — `moduleId`, `version` (semver), `manifest` (Json), `bundleUrl`,
  `bundleHash`, `sdkRange`, `permissions` (Json), `changelog`, `data` (Json — declarative payload
  for Tier 0), `yanked` (Boolean), `publishedAt`. *Immutable per version; updates = new version.*
- **`ModuleInstall`** — `moduleId`, `versionId`, `userId`, optional `languageId`, `settings` (Json),
  `enabled`, `grantedPermissions` (Json), timestamps. `languageId` **set** ⇒ scoped to that one
  language; `languageId` **null** ⇒ account-wide. `@@unique([moduleId, userId, languageId])`
  (Postgres treats nulls as distinct, so account-wide and per-language adds coexist). Public-page
  rendering reads the **owner's** installs for that language, so visitors always see exactly what
  the owner enabled.
- **`ModuleReview`** — `moduleId`, `userId`, `rating` (1–5), `body`, timestamps.
  `@@unique([moduleId, userId])`.
- **`ModuleReport`** — abuse / security reports feeding a moderation queue.

`ratingSum`/`ratingCount` denormalize the average; `addCount` denormalizes installs for cheap
sort/display. Module writes flow through Server Actions, so they appear in the existing `Activity`
and `AuditLog` tables. Migrations follow the documented `npm run db:migrate` flow; never edit old
migrations.

---

## 7. Marketplace product surfaces

**Routes:**

- `/modules` — marketplace home: featured, categories, trending, search.
- `/modules/[slug]` — module detail: README (via `react-markdown`, already a dependency),
  screenshots, requested permissions, versions/changelog, ratings & reviews, **Add** button,
  source link, author profile.
- `/modules/submit` & `/dashboard/modules` — author dashboard: create, upload/publish versions,
  analytics (adds, ratings), review status.
- `/studio/lang/[slug]/modules` — per-language manager (owner/editors only); enabled studio-panel
  modules then appear as **dynamic tabs** in `studio-layout.tsx` (refactor the hard-coded `tabs`
  array to merge in `contributes.studioPanel`).
- `/settings/modules` — account-wide adds & permission audit / revocation.
- `/admin/modules` — moderation queue, review, suspend/yank, audit (extends existing `/admin`).

**Add flow (instant, scope chosen at add time):** detail page or inline picker → **Add** →
permission-consent dialog (plain-language list) → **scope selector: this language vs. all my
languages** → record `ModuleInstall` (with or without `languageId`) → module is live immediately.
No download or build step for the user.

**Who controls the public page (owner-only):** only a language's owner/editors choose which modules
appear on its public page. Every visitor to that public page sees the **same** set — there are no
per-visitor variations of what a published language looks like.

**Reader experience + virality loop:**

- Public visitors can **use** owner-enabled reader modules (e.g. a conjugator widget) with **no
  account required** — read-only, fully sandboxed.
- Each reader widget surfaces a subtle **"Add to my language"** affordance. A logged-in visitor can
  one-click add that same module onto one of their own languages (scope selector applies), turning
  every public language into a discovery surface for the marketplace.
- Guests who click "Add to my language" are routed through sign-in, then the add completes.

**Discovery:** categories, type filters, sort by adds/rating/recent, full-text search (reuse
`lib/services/search.ts` patterns), "Official" and "Verified author" badges, add counts (the repo
already added a `NumberTicker` component for animated stats).

---

## 8. Developer experience

> This entire section is an **author-only** concern. People who merely *use* modules never see any
> of it — for them, adding is one hosted, instant click (§4 "Distribution").

- **Scaffold:** `npx create-lingocon-module` → template repo (manifest, SDK typings, an example,
  Vitest tests, build to a single ESM bundle).
- **Local dev mode:** a "Developer Mode" toggle in studio that **side-loads** an unpublished bundle
  from a local URL with hot reload, so authors test against their own real language before
  publishing. Gated behind the existing `DEV_MODE` / account-flag pattern.
- **Typed SDK** (`@lingocon/module-sdk`): full types for `ctx`, the manifest, and contribution
  points — the single source of truth for the contract.
- **Publishing:** via the author dashboard upload **or** a `lingocon publish` CLI. On submit, the
  **server builds the bundle from source** (reproducibly) so the published artifact provably matches
  the linked source — a strong trust signal and AGPL-friendly.
- **Docs:** a new section in the existing `/docs` system — "Building Modules," API reference,
  permission catalog, and review guidelines.

---

## 9. Security, moderation & trust

- **Isolation:** UI in sandboxed cross-origin iframes with strict CSP; compute in Workers with no
  network; all host access via the permissioned bridge. Modules cannot reach Prisma, cookies, or
  the session.
- **Server-enforced authz:** every module *write* re-enters through existing Server Actions, so
  `canEditLanguage` and ownership checks are never bypassed; nothing from the client is trusted.
- **Permission consent:** least-privilege, explicit grant at add time, revocable from
  `/settings/modules`.
- **Network egress:** only via a server proxy + domain allowlist + rate limit + logging (kills SSRF
  and data exfiltration by default).
- **Submission pipeline:** automated static analysis (bundle size, banned APIs, manifest/permission
  lint) → **manual review for first publish and permission escalations** → publish. Reproducible
  server build ties artifact to source.
- **Runtime safety:** per-module execution timeouts, memory/output caps, error isolation (a failing
  module never breaks the studio or reader).
- **Abuse handling:** report flow, moderation queue in `/admin`, **version yank / kill-switch** to
  instantly disable a malicious version platform-wide; author suspension via existing
  user-moderation fields.
- **Content policy:** no malware, no covert data collection, no IP infringement; honor language
  **visibility** (a module on a PRIVATE language must never exfiltrate it).

---

## 10. Governance, licensing & monetization

- **Licensing:** the host is **AGPLv3**. Require each module to declare an **OSI-approved license**,
  and require SDK-interacting modules to be **AGPL-compatible**. Whether the sandboxed bridge
  constitutes a derivative work is a genuine legal question to resolve with counsel **before
  launch**. *(Biggest non-technical risk.)*
- **Trust tiers:** *Official* (maintained by the LingoCon team), *Verified author*, *Community* —
  surfaced as badges.
- **Monetization:** **free + open only** for v1, with optional **author tipping/sponsorship** links
  (the repo already has a `donate` surface). No paid modules, no payments/tax/licensing complexity.

---

## 11. Phased rollout

- **Phase 0 — Foundations (data + nav):** add `Module*` Prisma models; refactor `studio-layout.tsx`
  so tabs are dynamically contributable; build the `/modules` catalog skeleton + author dashboard
  CRUD (no execution yet). **← in progress**
- **Phase 1 — Tier 0 declarative packs:** sound-change packs, themes, and word lists become
  addable/shareable. First real marketplace value, zero execution risk. Dogfood by converting
  built-in sound-change presets into packs.
- **Phase 2 — SDK + iframe sandbox + UI modules:** ship `@lingocon/module-sdk`, the sandboxed iframe
  runtime, the host bridge, and the permission model. **Deliver studio panels and reader widgets
  first** (the chosen priority). Dogfood with an official "stats panel" and a "conjugator" widget.
- **Phase 3 — Compute & content-block modules:** reuse the bridge for Worker-based compute
  (transformers/generators/validators/exporters) and TipTap content blocks. Dogfood by
  reimplementing the **word generator**, an **Anki exporter**, and the **IGT/paradigm** blocks as
  official modules.
- **Phase 4 — Marketplace maturity:** reviews/ratings, search/discovery, moderation tooling,
  reproducible server builds, developer mode + CLI, full docs.
- **Phase 5 (future):** Tier 2 WASM / server execution.

---

## 12. Risks & open questions

1. **AGPL compatibility of third-party modules** — needs a clear policy / legal read before launch
   (biggest non-technical risk).
2. **UI-module power vs. safety** — sandboxed iframes constrain how reader widgets look; we trade
   some flexibility for security. Acceptable for v1.
3. **SDK versioning churn** — a stable contract is essential or every host change breaks modules;
   semver `sdk` range gating is mandatory from day one.
4. **Moderation load** — manual first-publish review needs owner/admin time; automate aggressively.
5. **Per-language vs. account-wide installs** — *resolved:* both are supported, with the scope
   chosen at add time. Sensible defaults: studio panels default to **per-language**; exporters and
   themes default to **account-wide**. Public pages always reflect the **owner's** enabled set.
6. **Reader "Add to my language" abuse/spam** — the virality loop is powerful but must be
   rate-limited and respect the same permission-consent + moderation rules as any other add.

---

## 13. Phase 0 build status

Implemented in this pass (data + catalog scaffolding; no code execution yet):

- `Module`, `ModuleVersion`, `ModuleInstall`, `ModuleReview`, `ModuleReport` Prisma models + enums.
- `lib/modules/*` — shared types, category/type metadata, validations.
- `app/actions/module.ts` — author CRUD, publish a version, add/remove, review.
- `/modules` catalog + `/modules/[slug]` detail pages.
- `studio-layout.tsx` refactored to accept dynamic, install-driven tabs;
  `/studio/lang/[slug]/modules` per-language manager.

Still design-only: the sandbox runtime, the `@lingocon/module-sdk` package, the reader-widget host,
the publish/build pipeline, and moderation tooling.
