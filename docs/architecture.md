# LingoCon Architecture

## Overview

LingoCon is a Next.js 14 application using the App Router. It follows a layered architecture that separates concerns into validation, business logic, data access, and presentation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v5 (Auth.js) |
| Validation | Zod |
| UI | React 18 + shadcn/ui + Tailwind CSS |
| Rich Text | TipTap |
| State | React Hook Form + server actions |

## Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Components (app/, components/)             │
│  UI rendering, user interaction             │
├─────────────────────────────────────────────┤
│  Server Actions (app/actions/)              │
│  Auth, validation, orchestration            │
├─────────────────────────────────────────────┤
│  Services (lib/services/)                   │
│  Business logic, domain rules               │
├─────────────────────────────────────────────┤
│  Data Access (Prisma)                       │
│  Database queries, transactions             │
└─────────────────────────────────────────────┘
```

### Components (Presentation Layer)

- Located in `app/` (pages) and `components/` (shared)
- Call server actions for mutations
- Fetch data via server components or action queries
- Handle `ActionResult` responses (show toasts, update UI)

### Server Actions (Orchestration Layer)

Located in `app/actions/`. Each action function:

1. Checks authentication (`getUserId()`)
2. Validates input (Zod schema from `lib/validations/`)
3. Checks authorization (`canEditLanguage()`)
4. Calls service function (`lib/services/`)
5. Logs activity (`createActivity()`)
6. Revalidates cached paths (`revalidatePath()`)
7. Returns `ActionResult<T>`

Actions are **thin** — they should not contain business logic. They are the "glue" between Next.js concerns (caching, auth sessions) and pure business logic.

### Services (Business Logic Layer)

Located in `lib/services/`. Key rules:

- **No Next.js imports** — services must not import from `next/cache`, `next/navigation`, etc.
- **Receive userId as parameter** — services do not call `getUserId()` themselves
- **Throw AppError subclasses** — the action layer catches and translates to `ActionResult`
- **Testable with mocked Prisma** — no framework dependencies to mock

```typescript
// lib/services/dictionary-entry.ts
export async function createEntry(
  data: CreateDictionaryEntryInput,
  userId: string
): Promise<DictionaryEntry> {
  // Business logic here
  // Throws UnauthorizedError, NotFoundError, etc. on failure
  return prisma.dictionaryEntry.create({ data: { ... } })
}
```

### Data Access (Prisma)

- Schema defined in `prisma/schema.prisma` (38 models)
- Single client instance in `lib/prisma.ts`
- Services access Prisma directly — no extra repository layer needed at current scale

## Error Handling

```
Service throws AppError  →  Action catches  →  Returns ActionResult  →  Component shows toast
```

Error types (`lib/errors.ts`):
- `UnauthorizedError` — user lacks permission
- `NotFoundError` — entity doesn't exist
- `ValidationError` — business rule violation
- `ConflictError` — duplicate or conflicting state

## Validation

All input validation uses Zod schemas in `lib/validations/`:

- One file per domain entity (e.g., `dictionary-entry.ts`, `language.ts`)
- Schemas define max lengths, required fields, and shapes
- Both `create` and `update` schemas exist (update fields are optional)
- Type inference: `type CreateInput = z.infer<typeof createSchema>`

## Authentication & Authorization

- **Authentication**: NextAuth.js sessions via `getUserId()` / `requireAuth()`
- **Authorization**: Permission helpers in `lib/auth-helpers.ts`:
  - `canEditLanguage(languageId, userId)` — owner or EDITOR collaborator
  - `canViewLanguage(languageId, userId)` — owner, collaborator, or public
  - `isLanguageOwner(languageId, userId)` — owner only
- **Admin**: `isAdmin()` / `requireAdmin()` in `lib/admin.ts`
- **DEV_MODE**: Bypasses auth for local development

## Key Domain Models

```
User
 ├── Language (owns many)
 │    ├── DictionaryEntry (lemma, gloss, IPA, POS, etymology, tags)
 │    ├── GrammarPage (rich text documentation)
 │    ├── ScriptSymbol (alphabet characters)
 │    ├── Paradigm (inflection tables)
 │    ├── ExampleSentence
 │    ├── Text (books, poems)
 │    └── LanguageCollaborator (shared editing)
 ├── LanguageFamily (hierarchical family trees)
 │    └── ProtoWord (proto-language vocabulary)
 └── Activity (audit trail)
```

## Directory Conventions

| Path | Purpose |
|------|---------|
| `app/studio/lang/[slug]/` | Language editing workspace (feature-based routing) |
| `app/lang/[slug]/` | Public-facing language pages |
| `app/actions/<entity>.ts` | Server actions grouped by domain entity |
| `lib/services/<entity>.ts` | Service functions grouped by domain entity |
| `lib/validations/<entity>.ts` | Zod schemas grouped by domain entity |
| `lib/utils/` | Pure utility functions (slug generation, IPA detection, etc.) |
| `components/<feature>/` | Feature-scoped component directories |
| `tests/helpers/` | Shared test mock factories |
| `<dir>/__tests__/` | Co-located test files |

## Testing Strategy

- **Unit tests**: Validation schemas and utility functions (pure, no mocking)
- **Service tests**: Business logic with mocked Prisma (`tests/helpers/prisma-mock.ts`)
- **Action tests**: Thin integration tests with mocked auth + services
- **Component tests**: React Testing Library for interactive components

Test files are co-located: `lib/validations/__tests__/dictionary-entry.test.ts`
