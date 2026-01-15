"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { logAdminAction } from "@/app/actions/admin-audit"

/**
 * Suspend or unsuspend a user
 */
export async function toggleUserSuspension(
    userId: string,
    suspend: boolean,
    reason?: string
) {
    await requireAdmin()

    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            isSuspended: suspend,
            suspendedAt: suspend ? new Date() : null,
            suspendReason: suspend ? reason : null
        }
    })

    await logAdminAction({
        action: suspend ? "SUSPEND_USER" : "UNSUSPEND_USER",
        resource: "USER",
        resourceId: userId,
        details: { reason, userEmail: user.email }
    })

    revalidatePath(`/admin/users`)
    revalidatePath(`/admin/users/${userId}`)

    return { success: true, user }
}

/**
 * Update admin notes for a user
 */
export async function updateAdminNotes(userId: string, notes: string) {
    await requireAdmin()

    const user = await prisma.user.update({
        where: { id: userId },
        data: { adminNotes: notes || null }
    })

    await logAdminAction({
        action: "UPDATE_ADMIN_NOTES",
        resource: "USER",
        resourceId: userId,
        details: { userEmail: user.email }
    })

    revalidatePath(`/admin/users/${userId}`)

    return { success: true, user }
}

/**
 * Toggle user's admin status
 */
export async function toggleUserAdmin(userId: string, isAdmin: boolean) {
    await requireAdmin()

    const user = await prisma.user.update({
        where: { id: userId },
        data: { isAdmin }
    })

    revalidatePath(`/admin/users`)
    await logAdminAction({
        action: isAdmin ? "GRANT_ADMIN" : "REVOKE_ADMIN",
        resource: "USER",
        resourceId: userId,
        details: { userEmail: user.email }
    })

    revalidatePath(`/admin/users/${userId}`)

    return { success: true, user }
}
