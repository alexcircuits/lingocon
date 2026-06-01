import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { isRuntimeMethod, permissionForMethod } from "@/lib/modules/runtime-protocol"
import { loadModuleData } from "@/lib/modules/data"

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
    const candidateUserIds = [language.ownerId]
    if (userId && userId !== language.ownerId) candidateUserIds.push(userId)

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

    const declared = (install?.version.permissions as string[] | null) ?? []
    const consented = (install?.grantedPermissions as string[] | null) ?? []
    const granted = consented.length > 0 ? consented : declared
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
