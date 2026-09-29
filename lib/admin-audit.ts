/**
 * Append-only audit trail for admin actions. Server-only on purpose: when this lived in a
 * "use server" module it was a public endpoint, so any signed-in user could write audit rows.
 * Callers must already have verified the caller is an admin.
 */
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

interface LogActionParams {
    action: string
    resource: string
    resourceId?: string
    details?: unknown
}

export async function logAdminAction({
    action,
    resource,
    resourceId,
    details
}: LogActionParams) {
    try {
        const session = await auth()
        if (!session?.user?.id) return
        const serialized = details === undefined ? undefined : JSON.stringify(details)
        // Bound the row size; details are diagnostic, not a data store.
        const boundedDetails =
            serialized === undefined ? undefined : serialized.length > 10_000 ? { truncated: serialized.slice(0, 10_000) } : JSON.parse(serialized)

        await prisma.auditLog.create({
            data: {
                action,
                resource,
                resourceId,
                details: boundedDetails,
                adminId: session.user.id
            }
        })
    } catch (error) {
        console.error("Failed to log admin action:", error)
        // Don't throw, we don't want to break the main action if logging fails
    }
}

