import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { fetchLanguageForExport } from "@/lib/services/export-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const languageId = searchParams.get("languageId")

        if (!languageId) {
            return NextResponse.json({ error: "Language ID is required" }, { status: 400 })
        }

        const language = await fetchLanguageForExport(languageId, userId)

        return new NextResponse(JSON.stringify(language, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${language.slug}-data.json"`,
            },
        })
    } catch (error) {
        const err = error as Error
        console.error("JSON Export Error:", err)

        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }
        if (err.message === "Language not found") {
            return NextResponse.json({ error: "Language not found" }, { status: 404 })
        }

        return NextResponse.json({ error: "Failed to export JSON" }, { status: 500 })
    }
}
