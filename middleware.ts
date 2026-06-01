import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Matcher config: only run middleware on /lang/* and /studio/lang/* routes
export const config = {
  matcher: [
    '/lang/:slug*',
    '/studio/lang/:slug*',
  ],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Extract the slug from the pathname
  // Routes are either /lang/[slug]/... or /studio/lang/[slug]/...
  const match = pathname.match(/^(?:\/studio)?\/lang\/([^\/]+)(?:\/.*)?$/)
  if (!match) return NextResponse.next()

  const slug = match[1]

  try {
    // We cannot use Prisma in Edge middleware, so we call an internal API route
    // Use an absolute URL for the fetch
    const url = new URL(`/api/internal/slug-reservation/${slug}`, request.url)
    
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
      if (data.found && data.newSlug && data.newSlug !== slug) {
        // Replace the old slug with the new slug in the pathname
        const newPathname = pathname.replace(`/${slug}`, `/${data.newSlug}`)
        const redirectUrl = new URL(newPathname, request.url)
        
        // Return 307 Temporary Redirect with X-Robots-Tag: noindex
        const response = NextResponse.redirect(redirectUrl, 307)
        response.headers.set('X-Robots-Tag', 'noindex')
        return response
      }
    }
  } catch (error) {
    // If the API call fails (e.g., timeout, network issue), just continue
    // It's better to show a 404 than to break the site
    console.error('[Middleware] Slug reservation check failed:', error)
  }

  return NextResponse.next()
}
