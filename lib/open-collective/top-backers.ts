/**
 * The top financial backers of LingoCon, as the pages consume them: cached for
 * an hour and never throwing.
 */
import { unstable_cache } from "next/cache"
import {
  BACKERS_REVALIDATE_SECONDS,
  OPEN_COLLECTIVE_RETRY_COOLDOWN_MS,
  OPEN_COLLECTIVE_SLUG,
  TOP_BACKERS_LIMIT,
} from "./constants"
import { fetchTopBackers } from "./fetch-backers"
import { LookupCoolingDownError, createGuardedLookup } from "./guarded-lookup"
import type { Backer } from "./parse-backers"

export type TopBackersResult =
  | { readonly status: "ok"; readonly currency: string; readonly backers: readonly Backer[] }
  /** Open Collective could not be reached or answered with something unusable. */
  | { readonly status: "unavailable" }

/** Cache tag, for `revalidateTag` should an on-demand refresh ever be wanted. */
export const TOP_BACKERS_CACHE_TAG = "open-collective-backers"

/** One attempt at a time, and at most one per cooldown while Open Collective is failing. */
const lookUpTopBackers = createGuardedLookup(
  async () => {
    const { currency, backers, skipped } = await fetchTopBackers({
      slug: OPEN_COLLECTIVE_SLUG,
      limit: TOP_BACKERS_LIMIT,
    })
    // Logged here, not in getTopBackers: once per refresh rather than once per page view.
    if (skipped > 0) {
      console.warn(`[open-collective] skipped ${skipped} unusable member(s) in the backers response`)
    }
    return { currency, backers }
  },
  { cooldownMs: OPEN_COLLECTIVE_RETRY_COOLDOWN_MS },
)

/**
 * A rejected lookup is not stored, so an outage is not pinned for an hour; once
 * a list is cached, a failed background refresh keeps serving the last good one.
 */
const loadTopBackers = unstable_cache(
  lookUpTopBackers,
  ["open-collective-top-backers", OPEN_COLLECTIVE_SLUG, String(TOP_BACKERS_LIMIT)],
  { revalidate: BACKERS_REVALIDATE_SECONDS, tags: [TOP_BACKERS_CACHE_TAG] },
)

export async function getTopBackers(): Promise<TopBackersResult> {
  try {
    const { currency, backers } = await loadTopBackers()
    return { status: "ok", currency, backers }
  } catch (error) {
    // The failure that started the cooldown has already been logged.
    if (!(error instanceof LookupCoolingDownError)) {
      console.error("[open-collective] could not load top backers; hiding the section:", error)
    }
    return { status: "unavailable" }
  }
}
