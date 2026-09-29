# Local development

> **First time here?** Start with **[SETUP.md](../SETUP.md)** — one command (`npm run setup`) gets Postgres, migrations, and the dev server ready.

This document expands on the root README with **environment**, **scripts**, and **troubleshooting** details contributors hit most often.

## Requirements

- **Node.js 18+** (match the version used in production if you deploy).
- **PostgreSQL** reachable from your machine (or Docker via `npm run setup`).
- A GitHub or Google OAuth app **only if** you turn `DEV_MODE` off.

## First-time setup

```bash
npm run setup    # or npm run setup:full for demo data — see SETUP.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database URL format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Use a dedicated local database (for example `langua_dev`) so experimental migrations never touch personal data.

## Environment variables

`.env.example` lists the supported keys. Highlights:


| Variable                                                   | Purpose                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEV_MODE`                                                 | When `"true"`, `auth()` returns a synthetic dev session so you can skip OAuth setup. Must never be enabled in production (the app throws at startup if it is). |
| `DATABASE_URL`                                             | PostgreSQL connection string (required).                                                                                                                       |
| `NEXT_PUBLIC_SITE_URL`                                     | Canonical site URL for metadata and absolute links; defaults to production URL in code paths that fall back.                                                   |
| `AUTH_SECRET`                                              | Required for real auth in non-dev environments; generate with `openssl rand -base64 32`.                                                                       |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                | GitHub OAuth.                                                                                                                                                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                | Google OAuth.                                                                                                                                                  |
| `RESEND_API_KEY` / `EMAIL_FROM`                            | Transactional email (verification, password reset).                                                                                                            |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Optional Polly access for `/api/pronounce`.                                                                                                                    |


Never commit `.env` files or production secrets.

## npm scripts


| Script                | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run setup`       | One-shot local setup: `.env`, Docker Postgres, install, migrate.       |
| `npm run setup:full`  | Same as `setup`, plus sample language and official modules seeds.        |
| `npm run dev`         | Next.js development server with hot reload.                              |
| `npm run build`       | Production build — run before opening a PR that touches types or routes. |
| `npm run lint`        | ESLint via Next.js config.                                               |
| `npm run start`       | Serves the production build locally.                                     |
| `npm run db:migrate`  | `prisma migrate dev` — creates/applies migrations in development.        |
| `npm run db:generate` | Regenerates Prisma Client after schema changes.                          |
| `npm run db:studio`   | Opens Prisma Studio against `DATABASE_URL`.                              |
| `npm run db:seed`     | Runs `prisma/seed.ts` via `tsx`.                                         |


## Tests

| Command | What runs |
| --- | --- |
| `npm test` | Vitest unit/component suite (no database; Prisma is mocked). |
| `npx tsc --noEmit` | Type check (CI runs it; `next build` also type-checks). |
| `npm run lint` | ESLint — CI expects zero warnings. |
| `npm run test:e2e` | Playwright journeys against a dev server (`DEV_MODE="true"`, `npm run db:seed`). Set `E2E_BASE_URL` to reuse a running server. |
| `RUN_FTS_INTEGRATION=1 DATABASE_URL=… npx vitest run lib/services/__tests__/search-fts.integration.test.ts` | Real-Postgres search checks — point it at a throwaway database. |

## Background worker

`npx tsx scripts/worker.ts` runs the job queue locally (inflection regeneration, leagues). In
production it is the `lingocon-worker` PM2 app from `ecosystem.config.js`.

## Optional features

### IPA audio (AWS Polly)

Without AWS credentials the pronunciation route returns an error gracefully; the rest of the app works. See `app/api/pronounce/route.ts` for expected env vars and behavior.

### Email

Password reset and verification flows need Resend (or a compatible provider if you adapt `lib/email.ts`). In `DEV_MODE`, many flows short-circuit, but production-like testing requires real keys.

## Service workers

In **development**, the root layout unregisters service workers to avoid stale caches breaking Fast Refresh. If you debug SW-specific behavior, use a **production build** (`npm run build && npm run start`).

## Common issues

- `**PrismaClientInitializationError`** — `DATABASE_URL` wrong or database not running.
- **OAuth redirect mismatch** — callback URL in the provider console must match `AUTH_URL` / deployment domain.
- **“Unauthorized” from Server Actions** — expected if `DEV_MODE` is off and you have no session; either enable `DEV_MODE` locally or complete OAuth setup.

## Editor and formatting

The repository follows default Next.js ESLint rules. Run `npm run lint`, `npx tsc --noEmit` and `npm test` before pushing; CI runs the same checks on every pull request.