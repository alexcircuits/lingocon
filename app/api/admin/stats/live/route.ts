import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin"
import { getLiveStats } from "@/lib/stats/store"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }

/** Who is online right now, as counts only. Polled by the admin Traffic page. */
export async function GET(): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
  }
  try {
    return NextResponse.json(await getLiveStats(), { headers: NO_STORE })
  } catch (error) {
    console.error("[stats] could not read live stats:", error)
    return NextResponse.json({ error: "Could not load live statistics" }, { status: 500, headers: NO_STORE })
  }
}
