"use server"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { logAdminAction } from "@/lib/admin-audit"
import { ActionResult } from "@/lib/types/action-result"


// Never return the whole row: it includes the password hash.
const ADMIN_USER_SUMMARY = {
    id: true,
    name: true,
    email: true,
    isAdmin: true,
    isSuspended: true,
    suspendedAt: true,
    suspendReason: true,
    adminNotes: true,
} as const
type AdminUserSummary = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SUMMARY }>

/**
 * Suspend or unsuspend a user
 */
export async function toggleUserSuspension(
    userId: string,
    suspend: boolean,
    reason?: string
): Promise<ActionResult<AdminUserSummary>> {
    await requireAdmin()

    const user = await prisma.user.update({
        where: { id: userId },
        select: ADMIN_USER_SUMMARY,
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

    return { success: true, data: user }
}

/**
 * Update admin notes for a user
 */
export async function updateAdminNotes(userId: string, notes: string): Promise<ActionResult<AdminUserSummary>> {
    await requireAdmin()

    const user = await prisma.user.update({
        where: { id: userId },
        data: { adminNotes: notes || null },
        select: ADMIN_USER_SUMMARY,
    })

    await logAdminAction({
        action: "UPDATE_ADMIN_NOTES",
        resource: "USER",
        resourceId: userId,
        details: { userEmail: user.email }
    })

    revalidatePath(`/admin/users/${userId}`)

    return { success: true, data: user }
}

/**
 * Toggle user's admin status
 */
export async function toggleUserAdmin(userId: string, isAdmin: boolean): Promise<ActionResult<AdminUserSummary>> {
    await requireAdmin()

    const user = await prisma.user.update({
        where: { id: userId },
        data: { isAdmin },
        select: ADMIN_USER_SUMMARY,
    })

    revalidatePath(`/admin/users`)
    await logAdminAction({
        action: isAdmin ? "GRANT_ADMIN" : "REVOKE_ADMIN",
        resource: "USER",
        resourceId: userId,
        details: { userEmail: user.email }
    })

    revalidatePath(`/admin/users/${userId}`)

    return { success: true, data: user }
}
