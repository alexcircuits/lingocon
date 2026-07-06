# Wave 1: Learn-loop quick wins + Search v2 — Implementation Plan

> **For agentic workers:** Execute subagent-driven (fresh implementer + spec review + code-quality review per task). Steps use `- [ ]`. Stacked on `wave0-shared-infra` (Wave 0 unmerged) so the FTS foundation + search-fts service are present.

**Goal:** Five fast, high-value learn/search wins that need no new infra: wire the Wave 0 FTS search into the UI, add word-generator constraints, activate the dormant CLOZE/GRAMMAR_READ card types, close the lesson→FSRS gap, and ship an Anki/CSV deck export.

**Architecture:** Pure logic in `lib/` with vitest (TDD, mocked prisma via `vi.hoisted`); server actions/routes wire it up. The in-lesson exercise generator (`lib/lesson-generator.ts`) and the SRS card layer (`StudyCard`/`CardReview` + `lib/fsrs.ts`) are the two learn subsystems touched. No schema migration is required (all needed columns/enums already exist: `CardType.CLOZE`/`GRAMMAR_READ`, `StudyCard.dictEntryId`, `@@unique([enrollmentId, dictEntryId, cardType])`).

**Tech Stack:** Next.js 14 server actions + route handlers, Prisma/Postgres, vitest, next-intl (en/uk/fr/ru).

**Parent:** `docs/superpowers/plans/2026-07-03-lingocon-master-roadmap.md` (Wave 1).

---

## Ground rules
- Branch `wave1-learn-search` off `wave0-shared-infra`; conventional commits; PR base is `wave0-shared-infra` (stacked) until Wave 0 merges, then retarget to `main`.
- Test baseline entering Wave 1: **252**. Only grows.
- Gate per wave: `npm test` green → `tsc --noEmit` → `npm run build` → e2e 9/9 under Node 18 (explicit node18 binary: `~/.nvm/versions/node/v18.20.8/bin/node node_modules/@playwright/test/cli.js test`) → PR.
- i18n parity across en/uk/fr/ru for every user-facing string, same task.
- Never stage `app/opengraph-image.tsx` (user WIP). Dev DB safety: never `migrate diff`/`reset`/`db push`/`--shadow-database-url`.
- Order: 1 (search swap) → 2 (word-gen) → 3 (CLOZE) → 4 (lesson→SRS) → 5 (CSV export). 1/2/5 are isolated; 3 precedes 4 (4 consumes the `entryId` threading 3 introduces).

---

## Task 1 — Wire FTS search into the UI (roadmap 1.5, part 1)

Activates Wave 0's `lib/services/search-fts.ts` (currently unwired). The public search route swaps its engine; the `SearchResult`/`SearchScope` contract is identical, so no UI change.

**Files:** Modify `app/api/search/route.ts`. Test: `app/api/search/__tests__/route.test.ts` (new) OR extend an existing pattern.

- [ ] Read `app/api/search/route.ts`. It imports `{ search, SearchScope } from "@/lib/services/search"` and calls `search(query, scope)`.
- [ ] Change the import to `{ searchFts } from "@/lib/services/search-fts"` and `{ SearchScope } from "@/lib/services/search"` (types stay in search.ts), and call `searchFts(query, scope)`.
- [ ] Keep every other line (param parsing, response shape, error handling) identical.
- [ ] Verify: the three UI callers (`app/search/search-results.tsx`, `components/search/search-tabs.tsx`, `app/api/search/route.ts`) still import `SearchScope`/`SearchResult` from `@/lib/services/search` (unchanged).
- [ ] Live check: `npx tsx scripts/verify-fts.ts water` still returns `vand (water)`; start dev + hit `/api/search?q=water` → ranked JSON.
- [ ] `tsc` clean, full suite green. Commit: `feat(search): serve the ranked FTS engine from the public search route`.

**Non-goal (Task deferred to Wave 1b):** dictionary advanced search UI (POS filter, phoneme regex) — that's a larger surface; this task only swaps the engine so the win ships immediately.

---

## Task 2 — Word-generator constraints (roadmap 1.4)

**Files:** Modify `lib/utils/word-generator.ts` + `lib/utils/__tests__/word-generator.test.ts`; modify `app/studio/lang/[slug]/dictionary/components/word-generator-dialog.tsx`; i18n keys.

- [ ] Extend `WordGeneratorOptions` with `rejectPatterns?: string[]` (regex source strings) and `existingLemmas?: Set<string>` (dedupe). Both optional — existing callers unaffected.
- [ ] In `generateWords`: after building each candidate, skip it if it matches any compiled `rejectPatterns` regex OR is already in `existingLemmas`. Compile the regexes once (validate each with try/catch; skip invalid patterns rather than throw). Keep generating until the requested count is met or a bounded attempt cap (e.g. `count * 50`) is hit, so an over-constrained request terminates.
- [ ] TDD: tests first — rejects a forbidden cluster (`rejectPatterns: ["nn"]` never appears), dedupes against `existingLemmas`, terminates under impossible constraints (returns fewer than requested, does not hang), invalid regex is ignored not thrown.
- [ ] Dialog: add a "Forbidden sequences" textarea (newline/comma-split → `rejectPatterns`) and a "Hide words I already have" checkbox (passes the current dictionary lemmas as `existingLemmas`). Wire into the existing `generateWords({...})` call at dialog line ~155.
- [ ] i18n: new keys in all 4 locales.
- [ ] `tsc`, suite green. Commit: `feat(dictionary): word-generator forbidden-sequence + dedupe constraints`.

---

## Task 3 — Activate CLOZE + GRAMMAR_READ (roadmap 1.1)

Two dormant `CardType` enum values are never generated. Add in-lesson CLOZE exercises (fill-in-the-blank from example sentences) and generate `CLOZE`/`GRAMMAR_READ` StudyCards. Also threads a stable `entryId` onto graded exercises (consumed by Task 4).

**Files:** `types/lesson.ts`, `lib/lesson-generator.ts`, `lib/__tests__/lesson-generator.test.ts`, `app/learn/[slug]/lesson/[lessonId]/lesson-engine.tsx`, `app/actions/learn.ts` (StudyCard generation in `syncNewVocabCards`), i18n.

- [ ] `types/lesson.ts`: add
  ```typescript
  export interface ClozeExercise {
    type: "CLOZE"
    id: string
    entryId: string          // dictionary entry the blank tests
    sentence: string         // full sentence with the target word blanked as "____"
    answer: string           // the removed word (normalized lowercase/trim for grading)
    options: { id: string; text: string; correct: boolean }[]  // 1 correct + distractors
    translation?: string
  }
  ```
  Add `ClozeExercise` to the `Exercise` union. Also add an optional `entryId?: string` to `MultipleChoiceExercise` and `TranslateExercise` (Task 4 consumes it; optional keeps back-compat).
- [ ] `lib/lesson-generator.ts`: `buildCloze(item, pool)` — pick an example sentence, blank the occurrence of the lemma (case-insensitive whole-word), build options from same-POS distractors + the answer. Return `null` when the item has no example sentence containing the lemma. Emit `entryId: item.id`. Set `entryId` on the MC/Translate builders too. Insert cloze into the production round (guarded, like sentence-builder).
- [ ] `lesson-engine.tsx`: render `CLOZE` — reuse the multiple-choice UI with the gapped sentence as the prompt. (This file is large; add a `case "CLOZE"` branch mirroring `MULTIPLE_CHOICE`, do not restructure.)
- [ ] `app/actions/learn.ts` `syncNewVocabCards`: for entries with an example sentence, also create a `CLOZE` StudyCard (front = gapped sentence, back = answer); for grammar lesson items, create `GRAMMAR_READ` cards (front = title, back = excerpt). Respect the `@@unique([enrollmentId, dictEntryId, cardType])` constraint via the existing createMany+skipDuplicates pattern.
- [ ] TDD for the generator: cloze blanks the lemma, produces 1 correct option, returns null without a usable sentence, sets entryId. i18n for any new strings.
- [ ] `tsc`, suite green, build clean. Commit: `feat(learn): activate CLOZE + GRAMMAR_READ card types`.

---

## Task 4 — Close the lesson→FSRS gap (roadmap 1.2, the structural fix)

Today `completeLesson(lessonId, heartsLeft)` records XP/streak only — lesson performance never reschedules SRS cards. Feed graded results into FSRS.

**Files:** `lib/fsrs/lesson-to-review.ts` (new pure mapper) + test; `app/actions/learn.ts` (`completeLesson` signature + body); `lesson-engine.tsx` (collect per-exercise results, pass to `completeLesson`).

- [ ] Pure `lib/fsrs/lesson-to-review.ts`: `resultToRating(correct: boolean, perfect: boolean): RatingKey` → incorrect=`AGAIN`, correct=`GOOD`, correct-and-perfect-lesson=`EASY`. Tested first.
- [ ] `completeLesson(lessonId, heartsLeft, results?: { entryId: string; correct: boolean }[])` — new optional `results` param (back-compat: omitted = today's behavior). When present: within the existing `$transaction`, load the enrollment's `StudyCard`s whose `dictEntryId` is in the result set, and for each, run the existing `scheduleReview` FSRS path (as in `submitReview`) with the mapped rating, writing `StudyCard` updates + `CardReview` rows. `perfect` = no incorrect results. Reuse `submitReview`'s scheduling code — extract a shared helper `rescheduleCard(card, rating, timeTaken)` rather than duplicating.
- [ ] `lesson-engine.tsx`: accumulate `{ entryId, correct }` for each graded exercise that carries an `entryId` (from Task 3's threading), then pass the array to `completeLesson`. Dedupe by entryId keeping the worst outcome (any incorrect → incorrect) so one lapse schedules conservatively.
- [ ] TDD: mapper unit tests; an integration-style test of `completeLesson` with mocked prisma asserting `cardReview.create` + `studyCard.update` fire for matched entries, and that omitting `results` preserves the old path (no card writes).
- [ ] `tsc`, suite green. Commit: `feat(learn): lesson performance now feeds FSRS scheduling`.

---

## Task 5 — Anki/CSV deck export (roadmap 1.3)

Ship CSV first (no new deps). `.apkg` deferred to a Wave 1b fast-follow (needs a vendored SQLite template + zip dep).

**Files:** `app/api/export/deck/[languageId]/route.ts` (new, mirrors `app/api/export/csv/route.ts`); a download entry point (button) on the language hub or dictionary; test for the pure CSV row builder.

- [ ] Pure `lib/export/anki-csv.ts`: `toAnkiCsv(entries): string` — columns `front,back,ipa,example` (front=lemma, back=gloss), RFC-4180 quoting (escape quotes/commas/newlines). Tested first.
- [ ] Route: auth + fetch the language's dictionary entries (public, or owner/collaborator for private — mirror the existing csv route's access check), stream `text/csv` with `Content-Disposition: attachment; filename="<slug>-anki.csv"`.
- [ ] A "Export deck (CSV)" action wherever the existing export buttons live (find via the csv route's caller).
- [ ] `tsc`, suite green. Commit: `feat(export): Anki-compatible CSV deck export`.

---

## Task 6 — Wave gate + PR

- [ ] Full suite green (≈252 + new), `tsc` clean, `npm run build` succeeds.
- [ ] e2e 9/9 under Node 18 (explicit node18 binary invocation).
- [ ] `npx tsx scripts/verify-fts.ts water` still green; smoke `/api/search?q=`.
- [ ] Push `wave1-learn-search`; open PR **base `wave0-shared-infra`** (stacked) with a summary + test plan. Note the Wave 1b follow-ups: dictionary advanced-search UI, `.apkg` binary export.

## Risks
| Risk | Mitigation |
|------|-----------|
| Task 4 duplicates submitReview scheduling | Extract shared `rescheduleCard` helper; both paths call it |
| lesson-engine.tsx is large / user has WIP on it in main checkout | Work in stacked worktree (clean copy); minimal `case` additions, no restructure; note merge-conflict risk in PR |
| Over-constrained word-gen hangs | Bounded attempt cap returns partial set |
| CLOZE grading on native script | Normalize case/trim; options-based (tap) grading avoids typing ambiguity |
| Stacked PR base | Retarget to main once Wave 0 merges |
