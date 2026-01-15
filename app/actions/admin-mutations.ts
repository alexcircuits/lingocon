"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { revalidatePath } from "next/cache"

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

    const update = await prisma.platformUpdate.create({
        data: {
            title: data.title,
            description: data.description,
            icon: data.icon,
            link: data.link
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

    // Prevent removing admin from self if you are the only one (safety check could be added here)
    // For now, simpler implementation:
    const user = await prisma.user.update({
        where: { id: userId },
        data: { isAdmin }
    })

    revalidatePath(`/admin/users/${userId}`)
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
