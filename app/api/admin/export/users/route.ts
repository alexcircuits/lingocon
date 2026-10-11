import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/admin"
import { logAdminAction } from "@/lib/admin-audit"
import { format } from "date-fns"
import { sanitizeCsvCell } from "@/lib/export/csv-safe"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }

export async function GET() {
    // isAdmin, not requireAdmin: a redirect thrown inside the try below turned a refusal into a 500.
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
    }

    try {
        const users = await prisma.user.findMany({
            include: {
                _count: {
                    select: {
                        languages: true,
                        activities: true,
                        articles: true,
                        texts: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        })

        // Create CSV content
        const headers = [
            "ID",
            "Name",
            "Email",
            "Admin",
            "Languages",
            "Activities",
            "Articles",
            "Texts",
            "Created At"
        ]

        const rows = users.map(user => [
            user.id,
            user.name || "",
            user.email || "",
            user.isAdmin ? "Yes" : "No",
            user._count.languages,
            user._count.activities,
            user._count.articles,
            user._count.texts,
            format(new Date(user.createdAt), "yyyy-MM-dd HH:mm:ss")
        ])

        // User names are attacker-controlled: neutralize spreadsheet formulas and quote any cell
        // containing a delimiter, quote or line break.
        const csvCell = (cell: string | number) => {
            if (typeof cell !== "string") return String(cell)
            const safe = sanitizeCsvCell(cell)
            return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
        }
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(csvCell).join(","))
        ].join("\n")

        // Every user's email address leaves the system: no export without a record of who took it.
        if (!(await logAdminAction({ action: "EXPORT_USERS", resource: "USER", details: { count: users.length } }))) {
            return NextResponse.json({ error: "Export failed: it could not be recorded in the audit log" }, { status: 500, headers: NO_STORE })
        }

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                ...NO_STORE,
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="users-export-${format(new Date(), "yyyy-MM-dd")}.csv"`
            }
        })
    } catch (error) {
        console.error("Export error:", error)
        return NextResponse.json({ error: "Export failed" }, { status: 500, headers: NO_STORE })
    }
}
