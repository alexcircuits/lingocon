import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PATHNAME_HEADER } from '@/lib/project-path'

// Matcher config: only run middleware on /lang/* and /studio/lang/* routes
export const config = {
  matcher: [
    '/lang/:slug*',
    '/studio/lang/:slug*',
  ],
}

// Language slugs are [a-z0-9-] (see lib/validations/language.ts). Anything else can't be a renamed
// language, and must never be interpolated into the internal URL (ported from PR #49, which fixed
// CodeQL's SSRF finding here).
const SLUG_PATTERN = /^[a-z0-9-]{1,100}$/

// Reservations (old slug → new slug after a rename) are rare and change rarely, but every /lang and
// /studio/lang request (including RSC prefetches) used to trigger an HTTP self-call plus a DB query.
// Cache lookups per slug for a minute in the middleware module scope.
const CACHE_TTL_MS = 60_000
const CACHE_MAX_ENTRIES = 5_000
const reservationCache = new Map<string, { newSlug: string | null; expires: number }>()

function cacheGet(slug: string) {
  const hit = reservationCache.get(slug)
  if (!hit) return undefined
  if (hit.expires < Date.now()) {
    reservationCache.delete(slug)
    return undefined
  }
  return hit.newSlug
}

function cacheSet(slug: string, newSlug: string | null) {
  if (reservationCache.size >= CACHE_MAX_ENTRIES) reservationCache.clear()
  reservationCache.set(slug, { newSlug, expires: Date.now() + CACHE_TTL_MS })
}

function redirectToNewSlug(request: NextRequest, slug: string, newSlug: string) {
  const newPathname = request.nextUrl.pathname.replace(`/${slug}`, `/${newSlug}`)
  const response = NextResponse.redirect(new URL(newPathname, request.url), 307)
  response.headers.set('X-Robots-Tag', 'noindex')
  return response
}

/**
 * Only full document loads (typed URLs, bookmarks, external links) need the
 * renamed-slug redirect. In-app traffic — RSC navigations, router prefetches,
 * `router.refresh()` and Server Action POSTs, which all carry these headers —
 * already uses the current slug; when it does not, the language layouts look the
 * reservation up on their not-found path. Skipping them here keeps a loopback
 * HTTP request plus a database query (on every cache miss) off studio clicks,
 * saves and sidebar prefetches.
 */
/**
 * Only full page loads need the old-slug redirect: in-app navigations follow fresh
 * links and the studio layout redirects the rest. Next 14.2 strips the RSC/prefetch
 * headers and the `_rsc` parameter before middleware runs, so in-app fetches can't
 * be recognised by those. Page loads ask for HTML (RSC fetches accept any type):
 * that also covers crawlers and navigations the service worker forwards with fetch(),
 * which are not marked `Sec-Fetch-Dest: document`.
 */
function isPageLoad(request: NextRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const headers = request.headers
  return (
    headers.get('sec-fetch-dest') === 'document' ||
    headers.get('sec-fetch-mode') === 'navigate' ||
    (headers.get('accept') ?? '').includes('text/html')
  )
}

/**
 * Continue to the app, telling server layouts which path was requested: they cannot
 * see their own sub-path, and need it to send an old project slug to the same
 * section of the renamed project (in-app navigations never reach the lookup below).
 */
function continueWithPathname(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export async function middleware(request: NextRequest) {
  if (!isPageLoad(request)) return continueWithPathname(request)

  const { pathname } = request.nextUrl
  
  // Extract the slug from the pathname
  // Routes are either /lang/[slug]/... or /studio/lang/[slug]/...
  const match = pathname.match(/^(?:\/studio)?\/lang\/([^\/]+)(?:\/.*)?$/)
  if (!match) return continueWithPathname(request)

  const slug = match[1]
  if (!SLUG_PATTERN.test(slug)) return continueWithPathname(request)

  const cached = cacheGet(slug)
  if (cached !== undefined) {
    return cached && cached !== slug ? redirectToNewSlug(request, slug, cached) : continueWithPathname(request)
  }

  try {
    // We cannot use Prisma in Edge middleware, so we call an internal API route.
    // Target the app's own loopback HTTP origin rather than request.url: behind a
    // TLS-terminating proxy request.url is https, which makes the self-call attempt
    // a TLS handshake against the plain-HTTP Next server (ERR_SSL_PACKET_LENGTH_TOO_LONG).
    const internalOrigin =
      process.env.INTERNAL_API_ORIGIN || `http://127.0.0.1:${process.env.PORT || "3000"}`
    const url = new URL(`/api/internal/slug-reservation/${encodeURIComponent(slug)}`, internalOrigin)
    
    // Add a short timeout so we don't hang requests if the DB is slow
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        // Pass an internal header if needed
        'x-internal-auth': process.env.INTERNAL_API_KEY || 'dev-key'
      }
    })
    
    // Read the body inside the timeout window too.
    const data = res.ok ? await res.json().finally(() => clearTimeout(timeoutId)) : null
    clearTimeout(timeoutId)

    if (data) {
      const newSlug = data.found && typeof data.newSlug === 'string' ? data.newSlug : null
      // Only a found reservation is stable (it lasts 180 days). "No reservation" turns
      // stale the moment the project is renamed, so caching it sent page loads of the
      // old URL right after a rename past this redirect.
      if (newSlug) cacheSet(slug, newSlug)
      if (newSlug && newSlug !== slug) {
        // 307 Temporary Redirect with X-Robots-Tag: noindex
        return redirectToNewSlug(request, slug, newSlug)
      }
    }
  } catch (error) {
    // If the API call fails (e.g., timeout, network issue), just continue
    // It's better to show a 404 than to break the site
    console.error('[Middleware] Slug reservation check failed:', error)
  }

  return continueWithPathname(request)
}
