/**
 * Reads a collective's backers from Open Collective's public GraphQL API v2.
 *
 * Throws on any failure (network, timeout, HTTP status, GraphQL error, bad
 * shape, no usable member) so that a failed lookup is never cached;
 * `getTopBackers` turns the failure into a logged "unavailable" result.
 */
import { MEMBERS_FETCH_LIMIT, OPEN_COLLECTIVE_API_URL, OPEN_COLLECTIVE_TIMEOUT_MS } from "./constants"
import { OpenCollectiveResponseError, parseTopBackers, type TopBackers } from "./parse-backers"

/**
 * Public fields only. `account` (not `collective`) so the query keeps working
 * if the profile changes type. `orderByTotalContributed` makes the first page
 * the largest contributors; the result is still re-sorted locally.
 */
export const TOP_BACKERS_QUERY = /* GraphQL */ `
  query TopBackers($slug: String!, $limit: Int!) {
    account(slug: $slug) {
      currency
      members(role: [BACKER], limit: $limit, orderByTotalContributed: DESC) {
        nodes {
          role
          totalDonations {
            valueInCents
            currency
          }
          account {
            id
            slug
            name
            type
            imageUrl(height: 128)
            isIncognito
          }
        }
      }
    }
  }
`

export interface FetchTopBackersOptions {
  /** Slug of the collective. */
  slug: string
  /** Maximum number of backers to return. */
  limit: number
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function graphqlErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("errors" in body)) return null
  const { errors } = body
  if (!Array.isArray(errors) || errors.length === 0) return null
  const first: unknown = errors[0]
  const message =
    typeof first === "object" && first !== null && "message" in first ? String(first.message) : "unknown error"
  return message.slice(0, 200)
}

export async function fetchTopBackers({
  slug,
  limit,
  fetchImpl = fetch,
  timeoutMs = OPEN_COLLECTIVE_TIMEOUT_MS,
}: FetchTopBackersOptions): Promise<TopBackers> {
  const response = await fetchImpl(OPEN_COLLECTIVE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: TOP_BACKERS_QUERY,
      variables: { slug, limit: Math.max(limit, MEMBERS_FETCH_LIMIT) },
    }),
    // Caching is done one level up (unstable_cache), where failures can be excluded.
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Open Collective API responded with HTTP ${response.status}`)
  }

  const body: unknown = await response.json()
  const graphqlError = graphqlErrorMessage(body)
  if (graphqlError) {
    throw new Error(`Open Collective API returned a GraphQL error: ${graphqlError}`)
  }

  const result = parseTopBackers(body, limit)
  // Members came back but not one was usable: the schema has drifted. Fail rather
  // than let "no backers yet" be cached and shown for a collective that has some.
  if (result.backers.length === 0 && result.skipped > 0) {
    throw new OpenCollectiveResponseError(
      `None of the ${result.skipped} members in the Open Collective response could be used`,
    )
  }
  return result
}
