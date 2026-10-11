"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { httpUrlOrPathSchema } from "@/lib/validations/url"
import { logAdminAction } from "@/lib/admin-audit"

const createPlatformUpdateSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().min(2, "Description must be at least 2 characters").max(2000),
    icon: z.string().max(100).optional(),
    link: httpUrlOrPathSchema.optional().or(z.literal("")),
})

/**
 * Create a new platform update
 */
export async function createPlatformUpdate(data: {
    title: string
    description: string
    icon?: string
    link?: string
}) {
    await requireAdmin()

    const validated = createPlatformUpdateSchema.parse(data)

    const update = await prisma.platformUpdate.create({
        data: {
            title: validated.title,
            description: validated.description,
            icon: validated.icon,
            link: validated.link || undefined
        }
    })

    await logAdminAction({
        action: "CREATE_PLATFORM_UPDATE",
        resource: "PLATFORM_UPDATE",
        resourceId: update.id,
        details: { title: update.title }
    })
    revalidatePath("/admin/system")
    return { success: true, data: update }
}

/**
 * Delete a platform update
 */
export async function deletePlatformUpdate(id: string) {
    await requireAdmin()

    if (!id || typeof id !== "string") {
        throw new Error("Invalid update ID")
    }

    const deleted = await prisma.platformUpdate.delete({
        where: { id },
        select: { id: true, title: true }
    })

    await logAdminAction({
        action: "DELETE_PLATFORM_UPDATE",
        resource: "PLATFORM_UPDATE",
        resourceId: deleted.id,
        details: { title: deleted.title }
    })
    revalidatePath("/admin/system")
    return { success: true }
}

/**
 * Prune expired sessions and verification tokens
 */
export async function pruneSessions() {
    await requireAdmin()

    const now = new Date()

    const [sessions, tokens] = await Promise.all([
        prisma.session.deleteMany({
            where: { expires: { lt: now } }
        }),
        prisma.verificationToken.deleteMany({
            where: { expires: { lt: now } }
        })
    ])

    await logAdminAction({
        action: "PRUNE_SESSIONS",
        resource: "SYSTEM",
        details: { sessions: sessions.count, tokens: tokens.count }
    })

    return {
        success: true,
        data: {
            count: sessions.count + tokens.count,
            details: {
                sessions: sessions.count,
                tokens: tokens.count
            }
        }
    }
}
