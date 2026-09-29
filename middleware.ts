import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Extract the slug from the pathname
  // Routes are either /lang/[slug]/... or /studio/lang/[slug]/...
  const match = pathname.match(/^(?:\/studio)?\/lang\/([^\/]+)(?:\/.*)?$/)
  if (!match) return NextResponse.next()

  const slug = match[1]
  if (!SLUG_PATTERN.test(slug)) return NextResponse.next()

  const cached = cacheGet(slug)
  if (cached !== undefined) {
    return cached && cached !== slug ? redirectToNewSlug(request, slug, cached) : NextResponse.next()
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
    
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const newSlug = data.found && typeof data.newSlug === 'string' ? data.newSlug : null
      cacheSet(slug, newSlug)
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

  return NextResponse.next()
}
