# Server Actions and API routes

LingoCon uses two complementary server entry points:

1. **Server Actions** — async functions in `app/actions/*` marked with `"use server"`. They are imported directly into Server or Client Components.
2. **Route Handlers** — `app/api/**/route.ts` files exporting `GET`, `POST`, etc., for anything that must speak raw HTTP.

## Server Actions

### Conventions

- **File header:** start each action module with `"use server"` on the first line.
- **Auth first:** call `getUserId()` or `requireAuth()`, then `canEditLanguage` / `canViewLanguage` before reads or writes that touch a language.
- **Return shapes:** either plain objects like `{ error: string }` / `{ success: true }`, or the shared discriminated union **`ActionResult<T>`** from `lib/types/action-result.ts` for richer typing.
- **Revalidation:** after successful mutations, call `revalidatePath` for every user-visible path that embeds the changed data (studio and public routes).

### Example pattern (simplified)

```typescript
"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { toActionError } from "@/lib/errors"
import { revalidatePath } from "next/cache"

const thingUpdate = z.object({ title: z.string().trim().min(1).max(200) })

export async function updateThing(thingId: string, languageId: string, input: unknown) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  // 1. Scope-based permission on the language the caller names…
  if (!(await canEditScope(languageId, userId, "write:dictionary"))) return { error: "Forbidden" }

  try {
    // 2. …and the row must really live in that language.
    const existing = await prisma.thing.findUnique({ where: { id: thingId }, select: { languageId: true } })
    if (existing?.languageId !== languageId) return { error: "Not found" }

    // 3. Explicit, validated fields — never spread the raw input.
    const data = thingUpdate.parse(input)
    await prisma.thing.update({ where: { id: thingId }, data })
  } catch (error) {
    return { ...toActionError(error, "Failed to update thing") }
  }

  revalidatePath(`/studio/lang/${slug}/things`)
  return { success: true }
}
```

Every **exported** function in a `"use server"` file is callable from the browser, even if no
component imports it — keep helpers that trust their arguments out of these files.

### When **not** to use Server Actions

- Large **binary uploads** with custom progress — prefer a Route Handler or dedicated upload endpoint (the codebase already uses patterns under `app/api/` for some exports).
- **Webhooks** from third parties.
- **Non-React** consumers of the API.

## Route Handlers (`app/api`)

Notable groups:

| Area | Typical responsibility |
|------|------------------------|
| `app/api/auth/[...nextauth]/route.ts` | Auth.js HTTP surface — re-exports handlers from `auth.ts`. |
| `app/api/export/*` | PDF/DOCX/CSV generation for user content. |
| `app/api/pronounce/route.ts` | Optional Polly-backed audio. |
| `app/api/admin/*` | Administrative exports and maintenance endpoints (still check auth inside). |

Route Handlers should **reuse** `getUserId` / admin checks from `lib/` instead of inventing parallel auth logic.

## Client calling patterns

- **Server Actions** can be passed as props (`action={createText}`) or imported in Client Components when marked `"use server"` in the defining file.
- **Route Handlers** are called with `fetch("/api/...")` and must handle non-JSON error bodies explicitly.

## Testing

Unit tests can import pure helpers and small services from `lib/` directly. Actions that hit Prisma benefit from the shared mocks in `tests/helpers/` or integration tests against a disposable database — follow existing tests under `lib/**/__tests__` as templates.
