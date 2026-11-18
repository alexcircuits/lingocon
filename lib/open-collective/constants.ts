/** LingoCon's collective on Open Collective. */
export const OPEN_COLLECTIVE_SLUG = "lingocon"

export const OPEN_COLLECTIVE_ORIGIN = "https://opencollective.com"

/** Public page of the collective: where people donate and where the full backer list lives. */
export const OPEN_COLLECTIVE_URL = `${OPEN_COLLECTIVE_ORIGIN}/${OPEN_COLLECTIVE_SLUG}`

/**
 * GraphQL API v2. Public collective data needs no token; anonymous callers get
 * 10 requests per minute per IP (`x-ratelimit-limit`), far more than one cached
 * lookup an hour uses.
 */
export const OPEN_COLLECTIVE_API_URL = "https://api.opencollective.com/graphql/v2"

/** The only host avatar URLs may point at. */
export const OPEN_COLLECTIVE_IMAGE_HOST = "images.opencollective.com"

/** How many backers the site credits. */
export const TOP_BACKERS_LIMIT = 12

/**
 * Membership rows requested per lookup. An account has one row per tier it ever
 * joined, so more rows than {@link TOP_BACKERS_LIMIT} are needed to fill the list.
 */
export const MEMBERS_FETCH_LIMIT = 100

/** How long a fetched list is served before it is refreshed in the background. */
export const BACKERS_REVALIDATE_SECONDS = 3600

/** A lookup slower than this is abandoned; the page renders without the section. */
export const OPEN_COLLECTIVE_TIMEOUT_MS = 5000

/** After a failed lookup, how long to wait before asking Open Collective again. */
export const OPEN_COLLECTIVE_RETRY_COOLDOWN_MS = 60_000
