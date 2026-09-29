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
            // The full row includes the password hash and admin notes.
            select: { id: true, name: true, image: true },
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
        await prisma.$transaction(async (tx) => {
            // Articles, texts and courses cascade-delete with their author. Work the user wrote in
            // someone else's language (as a collaborator, or before transferring ownership) belongs
            // to that language too — hand it to the language owner instead of destroying it.
            await tx.$executeRaw`
                UPDATE articles a SET "authorId" = l."ownerId"
                FROM languages l
                WHERE a."languageId" = l.id AND a."authorId" = ${userId} AND l."ownerId" <> ${userId}`
            await tx.$executeRaw`
                UPDATE texts t SET "authorId" = l."ownerId"
                FROM languages l
                WHERE t."languageId" = l.id AND t."authorId" = ${userId} AND l."ownerId" <> ${userId}`
            await tx.$executeRaw`
                UPDATE courses c SET "authorId" = l."ownerId"
                FROM languages l
                WHERE c."languageId" = l.id AND c."authorId" = ${userId} AND l."ownerId" <> ${userId}`
            await tx.user.delete({ where: { id: userId } })
        })
        await signOut({ redirect: false })
        return { success: true }
    } catch (error) {
        console.error("[deleteAccount]", error)
        return { error: "Failed to delete account" }
    }
}

