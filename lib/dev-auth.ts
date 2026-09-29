/**
 * Resolves (and memoizes) the database user used when `DEV_MODE="true"`.
 *
 * The fixture email is defined in `lib/constants/dev-user.ts`. First call creates the row if
 * missing; subsequent calls reuse the cached id for the lifetime of the Node process.
 *
 * The lookup is memoized as a promise and uses `upsert`, so the burst of concurrent `auth()` calls
 * a fresh page render makes (layout, page, parallel server actions) cannot race on the unique
 * email and fail with P2002.
 */
import { prisma } from "./prisma"
import { DEV_MODE_USER_DISPLAY_NAME, DEV_MODE_USER_EMAIL } from "@/lib/constants/dev-user"

let devUserId: Promise<string> | null = null

export async function getDevUserId(): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "getDevUserId must never be called in production. Remove the DEV_MODE environment variable."
    )
  }

  if (!devUserId) {
    devUserId = prisma.user
      .upsert({
        where: { email: DEV_MODE_USER_EMAIL },
        update: {},
        create: { email: DEV_MODE_USER_EMAIL, name: DEV_MODE_USER_DISPLAY_NAME },
        select: { id: true },
      })
      .then((user) => user.id)
      .catch((error: unknown) => {
        // Do not cache a failure (e.g. database not up yet) — the next request retries.
        devUserId = null
        throw error
      })
  }

  return devUserId
}

