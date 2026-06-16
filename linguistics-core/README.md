# linguistics-core (Go → WASM)

A small Go module that hosts the CPU-bound **linguistics engine** for LingoCon —
starting with the **sound-change** pipeline. It is the one component where Go
earns its keep (pure, hot, well-specified compute); the rest of the platform
stays in TypeScript. See [`docs/audit/platform-audit.md`](../docs/audit/platform-audit.md) §5.

## Why Go here

- **Correctness.** Go's `regexp` is RE2 (no lookbehind/lookahead), which forced a
  proper **phoneme-aware position scanner** instead of regex. That design is
  correct-by-construction for adjacent/overlapping environments — e.g.
  `s → ∅ / V_V` over `asasa` deletes *both* intervocalic consonants (`aaa`),
  the bug the TS engine originally had.
- **Portability.** Compiled to WASM, it runs identically in every browser — no
  Safari-version lookbehind caveat — and server-side via the same package.
- **Speed.** No per-word regex compilation; class alternations are matched by
  direct rune-slice comparison.

## Layout

```
linguistics-core/
├── soundchange/        # the engine (pure Go, no syscall/js) + tests
│   ├── soundchange.go
│   ├── inventory.go    # default IPA vowel/consonant sets (mirrors the TS sets)
│   └── soundchange_test.go
├── wasm/main.go        # js+wasm entrypoint → registers globalThis.__linguisticsCore
└── build.sh            # GOOS=js GOARCH=wasm → public/wasm/
```

## Build

```bash
npm run build:wasm          # → public/wasm/sound-change.wasm + wasm_exec.js
```

Output lands in `public/wasm/` (gitignored). If the artifact is absent at
runtime, the web app **gracefully falls back** to the pure-TS engine
(`lib/utils/sound-change.ts`) — so the build step is optional for local dev but
should run in the deploy pipeline to activate the WASM path.

`build.sh` **prefers TinyGo** when it's on `PATH`, falling back to the standard
Go toolchain otherwise. Binary sizes:

| Toolchain | `sound-change.wasm` |
|-----------|---------------------|
| TinyGo 0.41 | **352 KB** |
| Go 1.25 | 2.8 MB |

> TinyGo gives an ~8× reduction here (reflection-based `encoding/json` keeps it
> off the theoretical ~30×). A further win is possible by replacing the JSON
> marshaling at the WASM boundary with manual string building.

## Test

```bash
go test ./...              # from linguistics-core/
```

## JS integration

- Loader (browser): [`lib/linguistics/sound-change-wasm.ts`](../lib/linguistics/sound-change-wasm.ts)
- React hook (WASM-or-JS, transparent upgrade): [`lib/linguistics/use-sound-change-engine.ts`](../lib/linguistics/use-sound-change-engine.ts)
- Wired into: `app/studio/lang/[slug]/sound-changes/sound-change-editor.tsx`
  (the live preview shows a `wasm`/`js` badge indicating the active engine).

## Roadmap

- [x] TinyGo build target to shrink the binary (2.8 MB → 352 KB).
- [ ] Replace JSON marshaling at the WASM boundary with manual string building (smaller still).
- [ ] Port phonotactics linter + IPA romanization into the same core.
- [ ] Expose a server-side path (Go HTTP worker or wasm-on-node) for large
      batch evolution jobs (`evolve-language`, `language-family`).
