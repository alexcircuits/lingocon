import { NextResponse } from "next/server"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { isRuntimeMethod } from "@/lib/modules/runtime-protocol"
import { loadModuleData } from "@/lib/modules/data"

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
  if (!(await canEditLanguage(languageId, userId))) {
    return NextResponse.json({ error: "You can only test against your own languages" }, { status: 403 })
  }

  const data = await loadModuleData(method, languageId)
  return NextResponse.json({ data })
}
