import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requestCache } from "@/lib/request-cache"

/**
 * Check if the current user is an admin
 * Returns true if the user has isAdmin: true in the database. Memoized per request — every
 * canEditScope/canViewLanguage call asks.
 */
export const isAdmin = requestCache(async function isAdmin(): Promise<boolean> {
    const session = await auth()

    if (!session?.user?.id) {
        return false
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true, isSuspended: true }
    })

    // A suspended admin keeps their session (JWT) but must lose admin rights immediately.
    return !!user?.isAdmin && !user.isSuspended
})

/**
 * Require admin access - redirects to dashboard if not admin
 * Use this at the top of admin pages/layouts
 */
export async function requireAdmin(): Promise<void> {
    const admin = await isAdmin()

    if (!admin) {
        redirect("/dashboard")
    }
}

/**
 * Get admin user data for display in admin UI
 */
export async function getAdminUser() {
    const session = await auth()

    if (!session?.user?.id) {
        return null
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isAdmin: true
        }
    })

    if (!user?.isAdmin) {
        return null
    }

    return user
}
