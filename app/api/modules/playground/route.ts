import { NextResponse } from "next/server"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { isRuntimeMethod } from "@/lib/modules/runtime-protocol"
import { loadModuleData } from "@/lib/modules/data"
import { MODULE_RATE_LIMIT_MESSAGE, moduleRateLimitRetryAfterMs } from "@/lib/modules/rate-limits"

export const dynamic = "force-dynamic"

/**
 * Data endpoint for the developer playground. Unlike the production route, no
 * module/install exists yet — so access is gated purely on the caller being
 * able to EDIT the selected language (i.e. it's their own data). Permission
 * gating is simulated client-side by the playground's permission toggles.
 */
export async function POST(req: Request) {
  let body: { languageId?: string; method?: string; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { languageId, method } = body
  if (!languageId || !isRuntimeMethod(method)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const userId = await getUserId()
  if (!(await canEditScope(languageId, userId, "manage:modules"))) {
    return NextResponse.json({ error: "You can only test against your own languages" }, { status: 403 })
  }

  // Past the edit check, so userId is set.
  const retryAfterMs = moduleRateLimitRetryAfterMs("playground", `user:${userId}`)
  if (retryAfterMs) {
    return NextResponse.json(
      { error: MODULE_RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const data = await loadModuleData(method, languageId)
  return NextResponse.json({ data })
}
