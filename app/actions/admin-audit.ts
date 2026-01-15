"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { requireAdmin } from "@/lib/admin"

interface LogActionParams {
    action: string
    resource: string
    resourceId?: string
    details?: any
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

        await prisma.auditLog.create({
            data: {
                action,
                resource,
                resourceId,
                details: details ? JSON.parse(JSON.stringify(details)) : undefined,
                adminId: session.user.id
            }
        })
    } catch (error) {
        console.error("Failed to log admin action:", error)
        // Don't throw, we don't want to break the main action if logging fails
    }
}

export async function getAuditLogs(params: {
    page?: number
    limit?: number
    adminId?: string
    action?: string
    resource?: string
} = {}) {
    // Only admins can view logs
    await requireAdmin()

    const { page = 1, limit = 50, adminId, action, resource } = params

    const where = {
        ...(adminId && { adminId }),
        ...(action && { action }),
        ...(resource && { resource })
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                admin: {
                    select: { name: true, email: true }
                }
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.auditLog.count({ where })
    ])

    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    }
}
