# End-to-end tests (Playwright)

Real-browser tests against a **production build** (`next build` + `next start`) with
**real sign-in**. Production matters: the service worker only registers there, and
streaming, caching and chunk loading behave differently from `next dev`. The shared
fixture fails a test on any uncaught client error or console error, so React
render/hydration bugs that a 200 response hides are caught too.

## How it works

- `e2e/seed.ts` creates role accounts with a known test password and two fixture
  languages (`e2e-public`, `e2e-private`) with content in every section. It refuses any
  database that is not local and named like a test database (or CI's throwaway one).
- `e2e/auth.setup.ts` (the `setup` project) signs every role in through `/login` and
  saves the sessions in `e2e/.auth/` (git-ignored); specs pick one with
  `signedInAs("owner")`. Roles: owner, editor (EDITOR on e2e-private), viewer (VIEWER on
  e2e-private), stranger, admin; `suspended@e2e.test` exists to prove it cannot sign in.
- Destructive flows (rename, delete, visibility, apply sound changes…) run on throwaway
  languages from `e2e/db.ts` (`createScratchLanguage`), never on the shared fixtures.
- Specs live in one folder per area; each folder may have its own `helpers.ts`.

## Running locally

```bash
# 1. A disposable database (never your real one)
createdb lingocon_e2e
export DATABASE_URL=postgresql://localhost:5432/lingocon_e2e
export AUTH_SECRET=local-e2e-secret AUTH_TRUST_HOST=true DEV_MODE=false
export AUTH_URL=http://localhost:3100 NEXT_PUBLIC_SITE_URL=http://localhost:3100
npx prisma migrate deploy && npm run db:seed && npx tsx e2e/seed.ts

# 2. Production build, then the suite (Playwright starts `next start` on :3100)
npm run build
npm run test:e2e

# One area, or against a server you already started
npx playwright test e2e/studio
E2E_BASE_URL=http://localhost:3100 npx playwright test --grep @overview

# The studio overview again with the Rust service serving its analysis
cargo build --release --manifest-path rust/Cargo.toml -p lingocon-api
E2E_RUST=1 npx playwright test --grep @overview
```

> **Node:** run the Playwright CLI with Node 18–22. If `npx playwright` fails with
> `context.conditions?.includes is not a function`, an ancestor `node_modules/.bin/node`
> (e.g. `~/node_modules`) is shadowing your Node — run
> `node node_modules/@playwright/test/cli.js test` instead.
>
> A server you start yourself for `E2E_BASE_URL` needs `PORT` set to its port
> (`PORT=3100 npx next start -p 3100`): the middleware's old-slug lookup calls back into
> it on `127.0.0.1:$PORT`, and the default 3000 may be another app.
>
> Login is rate-limited (30 attempts per IP per 15 minutes). The setup project uses 5;
> when iterating, reuse the saved sessions with `--no-deps`.

CI (`.github/workflows/ci.yml`) runs the whole suite (`e2e`) and the `@overview` specs
with the Rust service (`e2e-rust`).

## Coverage

| Folder | What it proves |
|--------|----------------|
| `public/` | Every public route renders signed out (404 for unknown paths); the language reader (home, alphabet, dictionary + server search, grammar in server HTML, paradigms, phonology, articles, texts, flashcards); private/unlisted visibility for every role; SEO (robots, sitemap without private languages, canonical/OG/noindex); locales; the service worker (registered with `updateViaCache: 'none'`, `/sw.js` not cacheable, old `lingocon-v1` caches purged, offline page, **no RSC/HTML of studio or reader pages in Cache Storage**). |
| `auth/` | Sign-in (success, wrong password, unknown email, unverified → verify page, suspended refused), registration + email verification, forgot/reset password (no account enumeration), sign-out, signed-out redirects. |
| `studio/` | Language creation (form + wizard, slugs, duplicates); overview counts, validation warnings and Swadesh coverage (`@overview`, also run against the Rust service); dictionary add/edit/delete **visible without reload**, search, details, find & replace, word generator, adversarial phonotactics input stays responsive; alphabet; phonology; paradigms; sound changes (WASM engine, preview, reviewed apply, adversarial rule stays fast); settings (rename + old-slug redirects, visibility, collaborators, delete); stale-UI regressions after client-side navigation. |
| `content/` | Grammar pages (rich text, server HTML, rename without not-found flash, reorder, delete), articles and texts (draft → publish → edit → unpublish/delete), courses (author → learner), flashcards (studio + public), translate, studio modules, the "may have changed" notice (never auto-reloads; Refresh keeps drafts), unsaved-draft warnings. |
| `access/` | Access matrix for the private language (signed out, stranger, viewer, editor, owner, admin) including **forced server-action writes** that must be rejected, suspended accounts, public-language studios. |
| `account/` | Dashboard, feed, families, modules; settings (profile, password, extension tokens); notifications, favorites, follows. |
| `learn/` | Learner pages, a full course journey (enrol → lesson → progress), practice/study, leaderboards, survey. |
| `admin/` | Every admin page; suspend/unsuspend with audit log; non-admins refused. |
| `journeys.spec.ts` | Public reader smoke tests on the default seed (`test-language`). |

Tests marked `test.fixme(true, "BUG: …")` document known app bugs: they assert the
correct behaviour and are enabled once the bug is fixed.
