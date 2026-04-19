# Codebase map

Use this as a **table of contents** for the repository. File counts change over time; the descriptions are what matter.

## Top level

| Path | Role |
|------|------|
| `app/` | Next.js App Router: pages, layouts, Server Actions, API routes, and global styles. |
| `components/` | Shared React UI: feature widgets and `components/ui/` (shadcn-based primitives). |
| `lib/` | Server-safe utilities, Prisma singleton, auth helpers, validations, TipTap extensions, hooks. |
| `prisma/` | `schema.prisma`, migrations, and seed scripts. |
| `public/` | Static assets, icons, service worker, manifests. |
| `types/` | Global TypeScript augmentations (for example `next-auth` session shape). |
| `tests/` | Test helpers (mocks); individual tests may live next to features under `lib/**/__tests__`. |

## `app/` — routes and orchestration

| Area | Purpose |
|------|---------|
| `app/actions/` | **Server Actions** — mutations and some queries that must run on the server with access to cookies/session. Each file tends to align with one domain: `text.ts`, `dictionary.ts`, `grammar-page.ts`, etc. |
| `app/docs/` | **In-app contributor docs** — renders the markdown from the repo `docs/` folder at `/docs` and `/docs/[slug]` (see `lib/docs/site-docs.ts`). |
| `app/api/` | **Route Handlers** — OAuth callback surface (`auth/[...nextauth]`), exports (PDF/DOCX), uploads, pronunciation, admin export, webhooks. Use when you need `Request`/`Response`, streaming, or non-React callers. |
| `app/lang/[slug]/` | Public reader experience for a language. |
| `app/studio/lang/[slug]/` | Authoring tools for the same language record. |
| `app/admin/` | Platform administration (users, languages, audit). |
| `app/dashboard/` | End-user dashboard (new language wizard, families, etc.). |

**Convention:** If it touches the database and needs the current user, it almost always belongs in `app/actions/` or an `app/api/*/route.ts` handler, not in a client component.

## `components/`

| Area | Purpose |
|------|---------|
| `components/ui/` | Low-level primitives (Button, Dialog, Form). Prefer composing these instead of importing Radix directly in feature code. |
| Other folders (`badges`, `comments`, `dictionary`, …) | Feature-level building blocks reused across multiple routes. |

## `lib/`

| Area | Purpose |
|------|---------|
| `lib/prisma.ts` | Singleton `PrismaClient` — always import from here, never `new PrismaClient()` in hot paths. |
| `lib/auth-helpers.ts` | Session-derived IDs and language permission checks. |
| `lib/dev-auth.ts` | Ensures a stable dev user when `DEV_MODE` is on. |
| `lib/validations/` | Zod schemas shared by forms and Server Actions. |
| `lib/tiptap/` | Editor extensions and node views. |
| `lib/utils/` | Pure helpers (slugging, CSV, transliteration, IPA helpers, etc.). |
| `lib/hooks/` | Client hooks (`useAutoSave`, toast helpers, …). |
| `lib/services/` | Domain services where logic outgrew a single action file (with tests alongside). |

## `prisma/`

- **`schema.prisma`** is the source of truth for tables and enums.
- **`migrations/`** holds applied migration SQL — never edit old migrations; add a new one.
- **Seeds** (`seed.ts`, `seed-badges.ts`, …) populate local data — safe to extend for fixtures.

## Naming and imports

- Path alias **`@/`** maps to the repository root (see `tsconfig.json`).
- Prefer **named exports** for actions and utilities unless a file already established a default export pattern.

## When you add a feature

1. **Schema** — extend `prisma/schema.prisma`, run `npm run db:migrate`.
2. **Validation** — add or extend Zod schemas under `lib/validations/`.
3. **Mutation** — implement a Server Action in `app/actions/`, call `getUserId` / `canEditLanguage`, then `revalidatePath`.
4. **UI** — add a page under `app/studio/...` for editing and `app/lang/...` for reading if the content is public.

This keeps permissions and caching in one predictable pipeline.
