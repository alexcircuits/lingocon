# Reliability and performance pass — October 2026

Branch `perf-reliability`, based on `main` at `b3309af` (what lingocon.com serves). This record covers what changed, why, and how it was verified. Nothing here is deployed yet.

## User-facing problems and their causes

| Report | Root cause on `main` | Fix |
|---|---|---|
| Saved word doesn't appear until a manual reload; older versions reappear | `public/sw.js` (cache `lingocon-v1`) answered every non-navigation `GET` under `/studio/` and `/lang/` — including the `?_rsc=` payloads behind `router.refresh()` and in-app navigation — **from cache first**. After a save, the follow-up refresh came back stale; a manual reload is a network-first navigation, so it showed the new data. Reproduced in a real browser against a build of `main`. | New worker that caches only content-addressed `/_next/static/` (bounded to 400 entries), never HTML/RSC, purges `lingocon-v1`, registered with `updateViaCache: 'none'`, `/sw.js` served `no-store`. Redundant `router.refresh()` calls after actions that already revalidate were removed (the action response already carries the re-rendered page, and the extra `GET` was the request the old worker answered stale). |
| A new word "isn't saved" in larger dictionaries | It was saved, but sorted onto another page or hidden by the current filter. | `useRevealCreatedEntry` switches to the newest-first view only when the re-rendered page doesn't contain the new entry. |
| Older content reappears after editing in two tabs / with collaborators | Settings and Phonology saved the whole metadata object from a page-load snapshot (reverting e.g. sound-change rules saved elsewhere); grammar/article/text saves had no revision check. | Metadata saves are an atomic `jsonb ||` merge of the editor's own keys; documents use `expectedUpdatedAt` compare-and-swap with a "changed elsewhere" message that keeps the draft. |
| Sound changes applied differently from the preview | Apply used whatever rules were stored; the preview read a key nothing writes (`metadata.phonology`). | Apply requires the reviewed rules/inventory and rejects if they changed (checked under a row lock); one shared input builder for page, editor and action. |
| Blank screens / 404 after saving | Renaming an article/text/grammar page refreshed the old URL (404); overview and paradigms pages rendered nothing for a missing project; one legacy metadata value threw while rendering the dictionary; the deploy built into the live `.next`, deleting chunks open tabs still needed; "Try again" only called `reset()`. | Editors move to the new URL; explicit `notFound()` inside the studio shell (`[slug]/not-found.tsx`, `error.tsx`, `loading.tsx`); tolerant `parseLanguageMetadata`; release-directory deploys that carry recent chunks forward; chunk-load recovery and a root `global-error.tsx`; retry refetches server data. |
| Lag | See measurements. Also: read-only Server Actions (badge check per navigation, four bell reads per page) queued in front of saves in Next 14's action queue; middleware made a loopback request + DB query for in-app requests. | Background reads are `GET` routes (`/api/me/*`); middleware only checks reservations on full page loads. |

## Security fixes found on the way (live on `main` today)

- `updateLanguageMetadata` chose one permission scope for a mixed patch, so a settings-only collaborator could write `soundChangeRules`/phonology keys by adding a settings key. Every touched scope is now required.
- `createAndAddSentence` let grammar-only collaborators add dictionary content; `createAndAddVocab` skipped dictionary validation, activity and revalidation. Both go through the dictionary rules now.
- `getUnnotifiedBadges(userId?)` / `getRecentAchievements(userId?)` were Server Actions accepting any user ID. The user now always comes from the session.
- Lesson reorders silently accepted IDs from other lessons; requests with foreign or duplicate IDs are now rejected.

## Measurements (local, 100k-word project, same data and machine, medians of 3)

| Route | Before (`main`) | After |
|---|---|---|
| Studio overview, full load | 1.95 MB, 641 ms | 163 KB, 455 ms (lexicon analysis streams after the shell) |
| Studio overview, in-app navigation | 1.61 MB, 497 ms | 20 KB, 452 ms |
| Studio flashcards | 14.1 MB, 925 ms | 417 KB, 191 ms (bounded per-part-of-speech sample) |
| Public flashcards | 14.2 MB, 967 ms | 423 KB, 179 ms |
| Settings, in-app navigation | 15 SQL, 39 ms DB, 62 ms | 14 SQL, 10 ms DB, 30 ms |
| Dashboard | 41 ms | 27 ms |
| Overview first-load JS | 281 kB | 170 kB (charts lazy-loaded from a client module) |

Fonts used only by the Russian/Ukrainian interface (~500 KB of TTF) and two fallback/accent faces are no longer preloaded on every page. Wall times are local lab timings, not production percentiles; LCP/INP/CLS were not measured in the field.

## Verification

- `vitest`: 1,072 tests pass (2 opt-in skips) with the database suites enabled (`DATABASE_URL` pointing at a disposable local `lingocon_rewrite_test_*` database); baseline `main` had 853.
- `tsc --noEmit` and `next lint`: clean. Production build: passes.
- Real browser (Playwright, production build): add / edit / delete a word, navigate away and back, add a word that sorts onto a later page, rename a grammar page — no manual reload needed, no full page reload, no console errors. On `main` the added word did not appear.

## Deploying

1. Deploy as one release (worker, `offline.html`, registration change and `/sw.js` header together). Existing clients switch when the browser re-checks `/sw.js`; the new worker deletes the old cache on activation.
2. `deploy.sh` now builds into `.next-releases/<timestamp>`, records it in `.next-release` (read by `next.config.js` on `next start`), reloads PM2, and verifies the served `BUILD_ID`. First run: the previous `.next` is used as the source of carried-over chunks.
3. Check `DATABASE_URL`'s `connection_limit` for PM2 cluster mode (see `.env.example`).

## Known remaining issues

- In Next 14.2, a revalidating Server Action re-renders the page and **remounts its client components**, so local UI state (row selection, toggles) resets after each save. Pre-existing; not fixed here.
- An in-app link to a renamed project's old slug redirects to the project root (full page loads keep the sub-path via middleware). The reservation API reveals a private project's new slug (pre-existing).
- The Rust rewrite and other large uncommitted work exist only in the older `language-page-builder` checkouts, not on `main`.
