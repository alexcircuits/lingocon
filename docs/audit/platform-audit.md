# LingoCon / Langua — Platform Audit

_Date: 2026-06-15 · Scope: `app/`, `components/`, `lib/`, `prisma/`, `app/api/` (~78k LOC, 556 source files)_

## TL;DR

The codebase is **not** "shitcode" in the language sense — TypeScript is used competently
(Zod validation, `requireAuth`/`canEditLanguage` helpers, immutable updates, a genuinely
well-designed capability-gated module sandbox). The real problems are **structural and
operational**:

1. **God-files** — a handful of 700–1558-line files concentrate most of the pain.
2. **Almost no loading/error UX** — 86 routes, **2** `loading.tsx`, **1** `error.tsx`.
3. **Tests are effectively absent** — 12 test files for 556 source files (~2% vs the 80% house rule).
4. **Type drift papered over with `as any`** (42 occurrences) and **72 `console.*`** in prod.
5. **One real correctness bug** in the sound-change engine (intervocalic rules).

**Rewriting in Go: no.** ~66% of the code is React UI that Go cannot host. But there is
**exactly one** part that genuinely belongs in Go (or Go→WASM): the **linguistics core**
(sound-change / phonology / evolution). See §5.

---

## 1. Severity-ranked findings

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| 1 | ✅ Fixed | **Sound-change engine produced linguistically wrong output** for adjacent environments (intervocalic deletion `s → ∅ / V_V` on `asasa` gave `aasa`, should be `aaa`). Fixed in this pass — environments are now zero-width lookbehind/lookahead so only the target is consumed; class alternations are cached. 13 regression tests added (`lib/utils/__tests__/sound-change.test.ts`). **Caveat:** the fix uses lookbehind, which Safari gained only in 16.4 — the live-preview editor (a client component) degrades gracefully (no-op) on older Safari; the server-side apply is correct everywhere. | `lib/utils/sound-change.ts:187` |
| 2 | 🔴 High | **No error boundaries** — 1 `error.tsx` for 86 routes. An unhandled throw in any server component shows the framework default, not a branded fallback. | `find app -name error.tsx` → 1 |
| 3 | 🟠 Med | **No loading states** — 2 `loading.tsx`, 6 `<Suspense>`. Navigation blocks with no skeletons; perceived performance is poor. | 2 / 86 routes |
| 4 | ✅ Fixed | **Test runner was not installed** — `vitest`/`@vitejs/plugin-react`/`jsdom` weren't in `package.json`, so the suite couldn't run and 4 files had silently rotted (incl. one masking a real `extractText` bug). Installed the deps + `npm test` script; repaired all 4 files; **now 169 unit tests pass** (grew from 152 as pure logic was extracted + tested). **Plus a Playwright E2E suite** (`e2e/`, 9 tests, `npm run test:e2e`) that smoke-tests the running app and validates the decomposed dictionary/course UI + the Go→WASM badge in a real browser — it already caught a pre-existing `/browse` React error. | `npm test` → 169; `test:e2e` → 9 |
| 5 | 🟡 Partly fixed | **Type drift hidden by `as any`.** The `audioUrl` case (8 casts across 3 dictionary components) was **legacy** — the props are typed as the full Prisma `DictionaryEntry`, which already includes `audioUrl`; the casts dated from a stale generated client. Removed all 8; `tsc` clean. `as any` total **42 → 34**; sweep the rest. | `as any`: 42 → 34 |
| 6 | 🟠 Med | **God-files** exceed the 800-line house limit (see §2). | — |
| 7 | ✅ Fixed | **Debug `console.log` + swallowed catches.** Removed all **3 `console.log`** (the actual rule violations — 2 were placeholder tour callbacks, 1 a font-load debug line) and un-swallowed the 2 meaningful `catch {}` (family-tree fetch → now logs + degrades gracefully; the `app/layout.tsx` inline-script guard is intentional). The remaining 69 `console.error` are legitimate catch-block error logging (Next.js captures server-side); a logger migration is optional polish, not a defect. | `console.log`: 3 → 0 |
| 8 | 🟡 Low | **Over-clientification** — 230/358 `.tsx` are `"use client"` (64%). Many could be server components → smaller JS, better SEO/streaming. | — |
| 9 | 🟡 Low | **Widget bundles authored as JS-in-template-strings** — 13 widgets, ~850 lines of untyped, unlinted, untested JavaScript inside `runtime-bundles.ts`. | `lib/modules/runtime-bundles.ts` |
| 10 | 🟡 Low | **`learn.ts` has 50 `find*` calls in one 1001-line file** — N+1 and transaction-boundary review needed. | `app/actions/learn.ts` |

### What's actually good (don't "fix" these)
- **Module sandbox** (`app/api/modules/data/route.ts`, `runtime-protocol.ts`): null-origin iframe,
  postMessage host SDK, capability/permission gating, view-authorization. Solid design.
- **Auth**: consistent `requireAuth` / `getUserId` + `canEditLanguage` ownership checks via `lib/auth-helpers.ts`.
- **Validation**: Zod schemas at action boundaries with inferred types.
- **Service layer exists** (`lib/services/*`) — the pattern to expand, not invent.

---

## 2. God-files (break these up first)

| File | Lines | Notes |
|---|---|---|
| `app/studio/lang/[slug]/courses/[courseId]/course-editor.tsx` | ~~1558~~ → **398** | ✅ Decomposed into 8 focused modules (verbatim moves, tsc clean). See [course-editor-decomposition.md](./course-editor-decomposition.md). |
| `app/learn/[slug]/lesson/[lessonId]/lesson-engine.tsx` | ~~1198~~ → **1135** | 🟡 Pure answer-checking logic extracted to a **tested** `lib/utils/lesson-answer.ts` (17 tests). Remaining: extract the per-exercise card components. |
| `app/actions/learn.ts` | 1001 | Split per entity (course/unit/lesson/item); push logic to `lib/services`. |
| `lib/modules/runtime-bundles.ts` | 959 | Move widget JS to real `.ts` source files, bundle at build (§4). |
| `app/studio/lang/[slug]/dictionary/dictionary-manager.tsx` | ~~881~~ → **686** | 🟡 Toolbar extracted to `components/dictionary-toolbar.tsx` (+ 2 dead imports removed). Remaining: dialogs cluster + actions hook. |
| `app/dashboard/families/components/language-family-builder.tsx` | 713 | — |
| `app/studio/lang/[slug]/phonology/phonology-view.tsx` | 704 | — |
| `lib/services/language-family.ts` | 672 | Candidate to share the Go linguistics core (§5). |
| `app/page.tsx` | 669 | Landing; extract sections to `components/landing/*`. |

**Approach:** the [course-editor decomposition](./course-editor-decomposition.md) is the
template — `useReducer` store + context (kills prop-drilling) + one optimistic-action helper +
split components. Mechanical, behavior-preserving, and it makes the logic unit-testable.

---

## 3. Bug deep-dive: `sound-change.ts`

```
s → ∅ / V_V   applied to "asasa"
```

`applyRule` builds `(V)(s)(V)` and runs `String.replace(/…/g)`. The regex **consumes** the
right-hand vowel as part of the match, so `.replace` resumes *after* it. The shared vowel
between two intervocalic `s` can only belong to one match:

- match 1 consumes `a s a` (idx 0–2) → `aa`, scan resumes at idx 3 (`sa`)
- second `s` no longer has a preceding vowel in the scan window → **not deleted**
- result `aasa` (wrong); correct is `aaa`

**Fix:** environments must be **zero-width** — left as lookbehind `(?<=…)`, right as lookahead
`(?=…)`, so only the target is consumed. This also simplifies the boundary-stripping hack at
`sound-change.ts:200`.

**Secondary (perf):** `V`/`C` expand to a ~50-way alternation **rebuilt and recompiled on every
`applyRule` call** — i.e. `O(words × rules)` regex compiles in `batchApply`. Precompile rules
once; cache the class alternations.

> Both the correctness fix and the perf fix are exactly why this module is the Go/WASM
> candidate in §5 — a small, pure, hot, well-specified compute kernel.

---

## 4. Module system quality

The **runtime/security** layer is good. The **authoring** layer is the weak point:

- `runtime-bundles.ts` ships 13 widgets as `const X = \`…JS…\`` template strings. That JS gets
  **no type-checking, no ESLint, no tests, no editor support** — 850 lines of blind code.
- **Recommendation:** author widgets as real `lib/modules/widgets/*.ts(x)` files compiled to
  standalone bundles at build time (esbuild). Same runtime, but the widget code becomes
  type-safe, lintable, and testable — and third-party authors get the same toolchain.
- `module.ts` action (572 lines, 13 exports) mixes CRUD + review + reports + admin + transform.
  Split into `module-crud.ts`, `module-moderation.ts`, `module-transform.ts`.

---

## 5. The Go question — answered precisely

**Verdict: do not rewrite. Extract one Go core.**

| Candidate | Go fit | Recommendation |
|---|---|---|
| **Linguistics core** — sound change, phonotactics, IPA, evolution (`lib/utils/sound-change.ts`, `ipa-*`, `language-family` evolution) | ★★★★★ | **Yes — PoC landed.** `linguistics-core/` ports the sound-change engine to Go as a phoneme-aware position scanner (RE2 has no lookarounds, so this is also faster and correct-by-construction). Compiles to WASM via **TinyGo** (`npm run build:wasm` → `public/wasm/`, **352 KB** vs 2.8 MB with plain Go), wired into the studio sound-change editor via `lib/linguistics/` with a transparent **JS fallback** and a `wasm`/`js` badge. Go + WASM-in-Node verified. Next: add a server batch path for `evolve-language`/`language-family`; port phonotactics/IPA. |
| **Export pipeline** — `/api/export/{xlsx,pdf,docx,csv,json}` | ★★★☆☆ | Optional. Heavy Node deps (`exceljs`, `docx`, `@react-pdf`) inflate the serverless bundle/memory. A Go export service is a reasonable later extraction if exports get heavy. |
| **Extension API** — `/api/ext/*` (token-auth'd read API) | ★★☆☆☆ | Optional/eventually. Self-contained read endpoints; could become a standalone Go service if the extension is decoupled. Low priority. |
| **Everything else** — React UI, server actions, Prisma/NextAuth glue, the iframe module runtime | ☆ | **No.** Go cannot host the browser UI; rewriting the data layer trades end-to-end type safety for a network boundary and duplicated types. |

**Target architecture:** keep Next.js as-is; add a single `linguistics-core` (Go) consumed two
ways — WASM in the browser for instant preview, and a thin HTTP worker for batch/server runs.
That is the *only* place Go earns its cost here.

---

## 6. Roadmap (suggested order)

**Phase 1 — Stop the bleeding (days)**
- ✅ **Done:** Fixed `sound-change.ts` correctness + alternation caching (finding #1); added 13
  regression tests (`lib/utils/__tests__/sound-change.test.ts`).
- ✅ **Done:** Installed the test runner (finding #4) — `vitest`, `@vitejs/plugin-react`, `jsdom`,
  `@testing-library/*` in devDeps + `npm test` / `npm run test:watch` scripts. Running the suite
  for the first time surfaced **4 rotted test files** (stale from never being run): 15 were
  mock-drift (`canEditLanguage` → `canEditScope`), 3 were wrong expectations, and **1 exposed a
  real bug** — `extractText` mashed sibling block nodes together (`"First"+"Second"` →
  `"FirstSecond"`), corrupting grammar-page search tokenization. Bug fixed, all **152 tests green**.
- ✅ **Done:** Added section-level `error.tsx` + `loading.tsx` boundaries (findings #2, #3) for
  `studio`, `learn`, `lang`, `dashboard` (+ `browse`/`search` loading), backed by two shared
  components (`components/feedback/section-error.tsx`, `page-skeleton.tsx`).
- ✅ **Done:** Removed the 3 debug `console.log` + un-swallowed the family-tree catches (#7);
  removed the 8 `audioUrl` `as any` casts (#5, 42 → 34 total).

**Phase 2 — Decompose (1–2 weeks)**
- Apply the [course-editor decomposition](./course-editor-decomposition.md) to the top-5 God-files.
- Fix the `audioUrl` type drift properly (Prisma `select` + shared DTO type) and delete those
  `as any` (#5). Sweep the rest.
- Split `learn.ts` and `module.ts` into per-concern service modules; audit `learn.ts` queries
  for N+1 and wrap multi-writes in `$transaction` (#10).

**Phase 3 — Foundations (ongoing)**
- ✅ **Started:** Go **linguistics core** PoC (`linguistics-core/`) — sound-change engine in
  Go→WASM, wired into the studio editor with JS fallback. TinyGo build wired in (2.8 MB → **352 KB**).
  See `linguistics-core/README.md`. Remaining: server-side batch path, port phonotactics/IPA.
- Move module widgets to compiled `.ts` source (#4, #9).
- Convert leaf presentational components from `"use client"` to server components where they
  hold no state (#8).
- Add a CI lint rule enforcing the 800-line ceiling so God-files can't regress; grow test
  coverage starting from the pure engines.

---

## 7. One-line conclusion

The frustration is real, but it points at **structure, tests, and UX polish — not the
language**. Fix those in place, extract one Go linguistics core, and "the shitcode feeling"
largely disappears without throwing away three years of accumulated, working behavior.
