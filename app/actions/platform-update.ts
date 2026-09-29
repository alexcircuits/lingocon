"use server"

// Public read of platform announcements. Creating them is admin-only and lives in
// `admin-mutations.ts` — an unauthenticated duplicate used to live here.
import { prisma } from "@/lib/prisma"

export async function getPlatformUpdates(limit = 5) {
    try {
        const updates = await prisma.platformUpdate.findMany({
            orderBy: {
                createdAt: "desc",
            },
            take: Math.min(Math.max(Math.floor(limit) || 5, 1), 20),
        })

        return {
            success: true,
            data: updates,
        }
    } catch (error) {
        console.error("Error fetching platform updates:", error)
        return {
            error: "Failed to fetch platform updates",
        }
    }
}
