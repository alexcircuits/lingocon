# Wave 2: Engine v2 (Lexurgy-class sound changes) — Implementation Plan

> **For agentic workers:** Executed incrementally (the wave is multi-week). Each increment is a self-contained, shippable slice of the Go `linguistics-core` engine, delivered subagent-driven with golden-file backward-compat tests. Branch `wave2-engine-classes` off `main` (independent of Waves 0/1 — the Go core is untouched by them).

**Goal:** Grow the Go/WASM sound-change engine from V/C/#/. into a Lexurgy-class system (user-defined classes, distinctive features, syllable-aware rules, named stages, backreferences), plus a debugger, rule test suites, and a phonotactics linter — without breaking a single existing saved ruleset.

**Architecture:** All engine work lands in `linguistics-core/soundchange` (Go) with table-driven + golden tests. New syntax is additive and version-free-by-absence: a ruleset with no new directives behaves byte-identically to today (proven by golden tests seeded from real rules). WASM bindings (`linguistics-core/wasm`), the TS wrapper (`lib/utils/sound-change.ts`), and the studio UI are wired in *later* increments, after each engine capability is proven in Go.

**Tech Stack:** Go 1.25 (`go test -race`), TinyGo/Go WASM, TypeScript wrapper, next studio UI.

**Parent:** `docs/superpowers/plans/2026-07-03-lingocon-master-roadmap.md` (Wave 2).

---

## Increment sequence (each is its own PR-able unit)

1. **Named sound classes** (this plan, detailed below) — `class K = p t k`; classes usable in rule environments and as whole-class targets. Go core only.
2. **Class wiring** — parse classes from the rules document in WASM/TS; studio UI accepts class definitions; apply-sound-changes + evolution route through them.
3. **Distinctive features** — `feature voiced: p/b, t/d, k/g`; `K → [+voiced] / V_V`. Feature matrix + arithmetic.
4. **Backreferences & multi-segment** — metathesis (`a i → i a`), gemination (`$1$1`).
5. **Syllabification + stress** — `syllables: (C)V(C)`, auto-syllabify, stress rules.
6. **Stages + romanizers** — named checkpoints; per-stage output; intermediate romanizers.
7. **Debugger + rule test suites** — per-word derivation trace UI; `RuleTest` model with red/green cases.
8. **Phonotactics linter** — validate the dictionary against declared syllable shapes/inventory.
9. **Evolution preview-diff** — dry-run screen before applying evolution.

Increments 1–6 are Go-core + wiring; 7–9 are product features consuming the engine. This document details **Increment 1**; later increments get their own plans.

---

## Increment 1 — Named sound classes (Go core)

### Design

- **Syntax:** lines of the form `class NAME = m1 m2 m3` (whitespace-separated members) define a named phoneme class. `NAME` is an identifier (letters, uppercase by convention, ≥1 char). Members may be multi-rune phonemes (`tʃ`, `aː`). Class-definition lines live in the same text block as rules and are parsed out.
- **Use in rules:** a class name is usable (a) in the left/right **environment** (like the built-in `V`/`C`), matching any one member; and (b) as a whole-word **target**, matching any one member and replacing it with the rule's replacement (single replacement for all members — class→class parallel mapping is a later increment).
- **Tokenizer:** environment/target tokenization becomes class-aware: at each position, match the longest known class name first, else the built-in `V`/`C`/`.`/`#`, else a literal rune. Built-ins `V`/`C` remain reserved.
- **Backward compatibility (CRITICAL):** existing rulesets contain no `class` lines and no class-name tokens, so they parse to zero classes and every rule behaves exactly as today. This MUST be proven with golden tests: a set of representative real rules asserted to produce identical output through the new code path.

### Files
- Modify: `linguistics-core/soundchange/soundchange.go`
- New: `linguistics-core/soundchange/classes.go` (parsing + class storage, to keep soundchange.go focused)
- Modify/extend: `linguistics-core/soundchange/soundchange_test.go` (or a new `classes_test.go` + `golden_test.go`)

### API shape (additive — do not break existing exports)

```go
// Program is a parsed rules document: class definitions + rules.
type Program struct {
    Classes map[string][]string // name → members (insertion order preserved separately if needed)
    Rules   []Rule
}

// Parse splits a text block into class definitions and rules. Lines like
// "class K = p t k" become classes; everything else goes through ParseRule.
func Parse(text string) Program

// NewEngineWithClasses builds an engine with user classes registered.
func NewEngineWithClasses(vowels, consonants []string, classes map[string][]string) *Engine

// (Engine gains an unexported `userClasses map[string][][]rune`, built longest-first
//  per class like vowels/consonants. class token lookup uses it.)
```

Existing `NewEngine`, `NewEngineOrDefault`, `ParseRule`, `ParseRules`, `ApplyRule`, `ApplyPipeline`, `BatchApply` stay and behave unchanged (an engine with no user classes tokenizes exactly as before).

### Tasks

#### Task 1.1 — Parse class definitions (TDD)
- Add `Parse(text) Program` + a `parseClassLine(line) (name string, members []string, ok bool)` in `classes.go`.
- Golden/behavior tests: `class K = p t k` → `{"K": ["p","t","k"]}`; extra whitespace tolerated; a `class` line with no `=` or empty RHS is ignored (not a rule, not a crash); non-class lines fall through to `ParseRule` and populate `Rules`; comments/blanks skipped as today.
- `Parse` on a class-free document returns `Classes == empty` and the same `Rules` as `ParseRules` (assert equality against `ParseRules` output).

#### Task 1.2 — Class-aware tokenizer + matcher (TDD)
- Add a `tokClass` token kind carrying the class name (or its member set). Change `tokenize` to `tokenize(env string, classes map[string][][]rune)` doing longest-class-name match first, then the existing per-rune logic. Update both call sites in `ApplyRule`.
- Extend `rightMatch`/`leftMatch` with a `tokClass` case using `matchPrefixClass`/`matchSuffixClass` against the class's member set.
- Tests: with `K = {p,t,k}`, `a → e / K_` raises `a` after any of p/t/k and not elsewhere; `a → e / _K` (right env); multi-rune member (`S = {tʃ, s}`, `a → e / S_` fires after `tʃ`). Assert non-members don't match.

#### Task 1.3 — Class as target (TDD)
- In `ApplyRule`, when `r.Target` is exactly a registered class name, match any one member (longest-first) at position `i` and emit the replacement (consuming the matched member's rune length). Environments still apply. When target is not a class, behavior is exactly as today.
- Tests: `K = {p,t,k}`, `K → ∅ / _#` deletes a final p/t/k; `K → h` turns any of p/t/k into h; a literal target unaffected; target class + environment class compose (`K → ∅ / V_V`).

#### Task 1.4 — Backward-compat golden tests
- Add `golden_test.go`: a table of representative real rules (draw from `TestBasicContexts`/`TestAdjacentEnvironments`/`TestMultiRunePhonemes` plus a few realistic multi-rule pipelines) run through BOTH the old path (`ParseRules` + `NewEngineOrDefault` + `ApplyPipeline`) and the new path (`Parse` + `NewEngineWithClasses` with empty classes + `ApplyPipeline`) — outputs must be byte-identical.
- Confirm `go test -race ./...` green and `go vet ./...` clean.

#### Task 1.5 — Gate + PR
- `go test -race ./soundchange/` green; `go vet ./...` clean; `gofmt -l` reports nothing.
- The WASM build still compiles (`bash linguistics-core/build.sh` or the documented build command) even though bindings are unchanged — confirm the package still builds for the `js/wasm` target.
- PR base `main`, titled "Wave 2 (increment 1): user-defined sound classes in the linguistics engine". Note follow-up increments (wiring to WASM/TS/UI is increment 2).

### Non-goals (Increment 1)
Feature matrix, syllabification, stages, romanizers, backreferences, class→class parallel mapping, and ANY WASM/TS/UI wiring. Increment 1 is a pure Go-core capability with tests; nothing user-facing changes yet (mirrors how Wave 0 built search-fts before Wave 1 wired it).

## Risks
| Risk | Mitigation |
|------|-----------|
| Breaks an existing ruleset | Golden tests assert byte-identical output on the new path with empty classes; class syntax is new so old rules have none |
| Class name collides with a literal phoneme | Convention: uppercase class names; tokenizer matches known class names only (a name is a class token only if defined); document that `V`/`C` are reserved |
| Tokenizer longest-match ambiguity (a class name that is a prefix of another) | Sort class names longest-first at lookup, mirroring the phoneme longest-first sort |
| Multi-rune member handling | Reuse the existing `toSortedRunes` longest-first machinery per class |
