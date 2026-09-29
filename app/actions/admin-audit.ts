"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

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

/**
 * Distinct action and resource values, used to populate audit log filters.
 */
export async function getAuditFilterOptions() {
    await requireAdmin()

    const [actions, resources] = await Promise.all([
        prisma.auditLog.findMany({
            select: { action: true },
            distinct: ["action"],
            orderBy: { action: "asc" }
        }),
        prisma.auditLog.findMany({
            select: { resource: true },
            distinct: ["resource"],
            orderBy: { resource: "asc" }
        })
    ])

    return {
        actions: actions.map((a) => a.action),
        resources: resources.map((r) => r.resource)
    }
}
