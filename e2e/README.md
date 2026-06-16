# End-to-end tests (Playwright)

Real-browser tests for critical flows. They double as a runtime smoke-test: the
shared fixture fails a test on any uncaught client error, so React
hydration/render bugs that a 200 SSR response hides get caught.

## Prerequisites

1. **`DEV_MODE="true"`** in `.env` — bypasses auth (studio pages render as a dev user).
2. **Seed data**: `npm run db:seed` (creates language slug **`test-language`** + entries).
   The studio specs expect that language owned by the dev user (`dev@localhost`).
3. **WASM built** (for the sound-change badge test): `npm run build:wasm`.

## Running

```bash
# Start its own dev server on :3000 (CI / clean machine)
npm run test:e2e

# …or target an already-running dev server (e.g. next dev picked :3002)
E2E_BASE_URL=http://localhost:3002 npx playwright test
```

> ⚠️ **Node version:** Playwright's TS loader is incompatible with Node 25
> (`context.conditions?.includes is not a function`). Run the E2E suite under
> **Node ≤ 22 / LTS** (e.g. `nvm use 18`). The vitest unit suite (`npm test`) is
> unaffected. The dev server under test can run on any Node version — only the
> test runner is sensitive.

## Coverage

| Spec | Validates |
|------|-----------|
| `public.spec.ts` | landing, browse, login, register render |
| `public-language.spec.ts` | `/lang/[slug]` home + public dictionary (the `audioUrl` fix) |
| `studio.spec.ts` | decomposed **dictionary toolbar + table**, **courses** page, and the **sound-change editor loading the Go→WASM core** (badge → `wasm`) |

## Known issue surfaced by this suite

`/browse` emits a *"Functions are not valid as a child of Client Components"*
React error. The page still renders, so its spec asserts functional content and
skips the strict error check (see the inline note). Tracked for a separate fix.
