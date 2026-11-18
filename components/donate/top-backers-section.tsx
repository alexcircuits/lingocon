import { getTopBackers } from "@/lib/open-collective/top-backers"
import { TopBackers } from "./top-backers"

/**
 * Fetches (cached hourly) and renders the top backers. Renders nothing when
 * Open Collective is unavailable. Wrap in `<Suspense>` so a slow lookup on a
 * cold cache never holds up the rest of the page.
 */
export async function TopBackersSection() {
    const result = await getTopBackers()
    if (result.status !== "ok") return null

    return <TopBackers backers={result.backers} currency={result.currency} />
}
