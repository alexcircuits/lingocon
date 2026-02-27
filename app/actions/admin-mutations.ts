"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const createPlatformUpdateSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().min(2, "Description must be at least 2 characters").max(2000),
    icon: z.string().max(100).optional(),
    link: z.string().url("Must be a valid URL").max(500).optional().or(z.literal("")),
})

const toggleUserAdminSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    isAdmin: z.boolean(),
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

    await prisma.platformUpdate.delete({
        where: { id }
    })

    revalidatePath("/admin/system")
    return { success: true }
}

/**
 * Toggle user admin status
 */
export async function toggleUserAdmin(userId: string, isAdmin: boolean) {
    await requireAdmin()

    const validated = toggleUserAdminSchema.parse({ userId, isAdmin })

    const user = await prisma.user.update({
        where: { id: validated.userId },
        data: { isAdmin: validated.isAdmin }
    })

    revalidatePath(`/admin/users/${validated.userId}`)
    revalidatePath("/admin/users")
    return { success: true, data: user }
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

    return {
        success: true,
        count: sessions.count + tokens.count,
        details: {
            sessions: sessions.count,
            tokens: tokens.count
        }
    }
}
