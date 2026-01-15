import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        await requireAdmin()

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

        const csvContent = [
            headers.join(","),
            ...rows.map(row =>
                row.map(cell =>
                    typeof cell === "string" && (cell.includes(",") || cell.includes('"'))
                        ? `"${cell.replace(/"/g, '""')}"`
                        : cell
                ).join(",")
            )
        ].join("\n")

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="users-export-${format(new Date(), "yyyy-MM-dd")}.csv"`
            }
        })
    } catch (error) {
        console.error("Export error:", error)
        return NextResponse.json({ error: "Export failed" }, { status: 500 })
    }
}
