# linguistics-core (Go → WASM)

A small Go module that hosts the CPU-bound **linguistics engine** for LingoCon —
starting with the **sound-change** pipeline. It is the one component where Go
earns its keep (pure, hot, well-specified compute); the rest of the platform
stays in TypeScript. See [`docs/audit/platform-audit.md`](../docs/audit/platform-audit.md) §5.

## Why Go here

- **Portability.** Compiled to WASM, it runs identically in every browser — no
  Safari-version lookbehind caveat.
- **Speed.** No per-word regex compilation; environments are computed as
  position sets, linear in word length × environment length.

## Parity with the server engine

The server applies rules with the TypeScript engine,
[`lib/utils/sound-change.ts`](../lib/utils/sound-change.ts), which is the
**reference**: the preview must show exactly what "Apply to dictionary" writes.
This engine mirrors it, including:

- environments are zero-width conditions that hold if **any** split matches
  (vowels `{a, aa}`: `a → e / _VVb` turns `aaab` into `eaab`), never greedy;
- `#` anywhere in an environment anchors it to the word edge; an environment of
  exactly `_` is no condition;
- text is handled as **UTF-16 code units**, like a JavaScript string: `.` is one
  unit other than a line terminator (so half of an astral character like 😀),
  and class members are ordered longest-first by unit count;
- replacements expand `` $& `` `` $` `` `` $' `` `` $$ `` like `String#replace`
  (`$1`, `$<x>` stay literal);
- the parser follows the TypeScript regex `/^(.+?)(?:→|[=–—-]+>|>)(.+)$/` and
  JavaScript's `trim`/`\s` whitespace (not Go's `unicode.IsSpace`);
- an absent inventory selects the default IPA set; a passed one is used as
  given — an empty one matches the empty string, like an empty `Set`.

The only inputs the engines cannot agree on are lone UTF-16 surrogates, which
cannot exist in a Go (UTF-8) string: the JS → Go boundary turns them into
U+FFFD. Real phoneme text never contains one.

[`lib/linguistics/__tests__/sound-change-wasm-parity.test.ts`](../lib/linguistics/__tests__/sound-change-wasm-parity.test.ts)
proves it: it runs the **built** `public/wasm/sound-change.wasm` through the
real loader and `useSoundChangeEngine` hook against `parseProgram` +
`batchApply` on 15,000 seeded random programs (≈53,000 words) plus fixed edge
cases. A stale binary fails it — rebuild after changing Go code.

## Layout

```
linguistics-core/
├── soundchange/        # the engine (pure Go, no syscall/js) + tests
│   ├── soundchange.go  # Engine, constructors, ApplyRule/ApplyPipeline/BatchApply
│   ├── match.go        # UTF-16 position-set matcher + `$` replacement expansion
│   ├── parse.go        # rule parser (JavaScript whitespace + arrow regex)
│   ├── classes.go      # `class NAME = …` definitions
│   ├── inventory.go    # default IPA vowel/consonant sets (mirrors the TS sets)
│   └── *_test.go
├── wasm/main.go        # js+wasm entrypoint → registers globalThis.__linguisticsCore
└── build.sh            # GOOS=js GOARCH=wasm → public/wasm/
```

## Build

```bash
npm run build:wasm          # → public/wasm/sound-change.wasm + wasm_exec.js
```

Output lands in `public/wasm/`, which is committed — rebuild and commit it with
any Go change (the parity test runs the committed binary). If the artifact is
absent at runtime, the web app **gracefully falls back** to the pure-TS engine
(`lib/utils/sound-change.ts`).

`build.sh` **prefers TinyGo** when it's on `PATH`, falling back to the standard
Go toolchain otherwise. Binary sizes:

| Toolchain | `sound-change.wasm` |
|-----------|---------------------|
| TinyGo 0.41 | **364 KB** |
| Go 1.25 | 2.8 MB |

> TinyGo gives an ~8× reduction here (reflection-based `encoding/json` keeps it
> off the theoretical ~30×). A further win is possible by replacing the JSON
> marshaling at the WASM boundary with manual string building.

## Test

```bash
go test ./...              # from linguistics-core/
npx vitest run lib/linguistics   # WASM ↔ TypeScript parity (needs the built binary)
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
