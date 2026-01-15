import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

/**
 * Check if the current user is an admin
 * Returns true if the user has isAdmin: true in the database
 */
export async function isAdmin(): Promise<boolean> {
    const session = await auth()

    if (!session?.user?.id) {
        return false
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true }
    })

    return user?.isAdmin ?? false
}

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
