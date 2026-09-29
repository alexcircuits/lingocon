/**
 * Auth.js HTTP entrypoint — handles OAuth callbacks, CSRF checks, session cookies, etc.
 * All configuration lives in `auth.ts`; this file only re-exports the framework handlers.
 *
 * DEV_MODE: the synthetic dev session only exists server-side (`auth()`), so client components
 * using `useSession()` would otherwise see a signed-out user. Serve the same session here.
 */
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth, handlers } from "@/auth"

const isDevMode = process.env.DEV_MODE === "true"

export async function GET(request: NextRequest) {
  if (isDevMode && request.nextUrl.pathname.endsWith("/session")) {
    return NextResponse.json(await auth())
  }
  return handlers.GET(request)
}

export const { POST } = handlers
