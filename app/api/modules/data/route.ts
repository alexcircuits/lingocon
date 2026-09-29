import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage, canEditLanguage } from "@/lib/auth-helpers"
import { resolveGrantedPermissions } from "@/lib/modules/utils"
import { isRuntimeMethod, permissionForMethod } from "@/lib/modules/runtime-protocol"
import { loadModuleData } from "@/lib/modules/data"
import { MODULE_RATE_LIMIT_MESSAGE, moduleRateLimitRetryAfterMs } from "@/lib/modules/rate-limits"
import { clientIpFromHeaders } from "@/lib/request-ip"

export const dynamic = "force-dynamic"

/**
 * Capability-gated data endpoint for sandboxed modules. The host (parent page)
 * calls this on a module's behalf; the iframe never touches it directly.
 *
 * Enforces: (1) the caller may view the language, and (2) the language owner or
 * caller has an ENABLED install of this module whose granted permissions cover
 * the method's required permission.
 */
export async function POST(req: Request) {
  let body: { languageId?: string; moduleId?: string; method?: string; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { languageId, moduleId, method } = body
  if (!languageId || !moduleId || !isRuntimeMethod(method)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const userId = await getUserId()
  // Keyed per caller, language and module so one busy widget can't starve another (#31).
  const caller = userId ? `user:${userId}` : `ip:${clientIpFromHeaders(req.headers)}`
  const retryAfterMs =
    moduleRateLimitRetryAfterMs("dataCaller", caller) ||
    moduleRateLimitRetryAfterMs("data", `${caller}:${languageId}:${moduleId}`)
  if (retryAfterMs) return tooManyRequests(retryAfterMs)

  if (!(await canViewLanguage(languageId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { id: true, ownerId: true },
  })
  if (!language) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Permission gate: methods that touch data require a granted permission.
  const required = permissionForMethod(method)
  if (required) {
    // Data access is authorized by the OWNER's install (this is what powers
    // public reader widgets). A viewer's own install only counts when they can
    // edit this language — otherwise a logged-in visitor could use a personal
    // account-wide install to read any language they can merely view (#32).
    const candidateUserIds = [language.ownerId]
    if (userId && userId !== language.ownerId && (await canEditLanguage(languageId, userId))) {
      candidateUserIds.push(userId)
    }

    const install = await prisma.moduleInstall.findFirst({
      where: {
        moduleId,
        enabled: true,
        userId: { in: candidateUserIds },
        OR: [{ languageId }, { languageId: null }],
        module: { status: "PUBLISHED" },
      },
      select: {
        grantedPermissions: true,
        version: { select: { permissions: true } },
      },
    })

    const granted = resolveGrantedPermissions(install?.grantedPermissions, install?.version.permissions)
    if (!install || !granted.includes(required)) {
      return NextResponse.json(
        { error: `Permission "${required}" not granted for this module` },
        { status: 403 }
      )
    }
  }

  const data = await loadModuleData(method, language.id)
  return NextResponse.json({ data })
}

function tooManyRequests(retryAfterMs: number) {
  return NextResponse.json(
    { error: MODULE_RATE_LIMIT_MESSAGE },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
  )
}
