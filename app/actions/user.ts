"use server"

import { ZodError } from "zod"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/user"
import { revalidatePath } from "next/cache"
import { signOut } from "@/auth"

export async function updateUser(input: UpdateUserInput) {
    const userId = await getUserId()

    if (!userId) {
        return {
            error: "Unauthorized",
        }
    }

    try {
        const validated = updateUserSchema.parse(input)

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                name: validated.name,
                image: validated.image || null,
            },
        })

        revalidatePath(`/users/${userId}`)
        revalidatePath("/settings")

        return {
            success: true,
            data: updated,
        }
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                error: error.issues[0]?.message || "Validation failed",
            }
        }
        if (error instanceof Error) {
            return {
                error: error.message,
            }
        }
        return {
            error: "Failed to update profile",
        }
    }
}

export async function deleteAccount() {
    const userId = await getUserId()

    if (!userId) {
        return { error: "Unauthorized" }
    }

    try {
        await prisma.user.delete({ where: { id: userId } })
        await signOut({ redirect: false })
        return { success: true }
    } catch (error) {
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: "Failed to delete account" }
    }
}

export async function searchUsers(query: string) {
    const userId = await getUserId()

    if (!userId) {
        return { error: "Unauthorized" }
    }

    if (query.length < 2) {
        return { success: true, data: [] }
    }

    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
                NOT: {
                    id: userId // Exclude self
                }
            },
            take: 10,
            select: {
                id: true,
                name: true,
                email: true,
                image: true
            }
        })

        return {
            success: true,
            data: users
        }
    } catch (error) {
        return { error: "Failed to search users" }
    }
}
