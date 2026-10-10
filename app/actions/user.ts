"use server"

import { prisma } from "@/lib/prisma"
import { toActionError } from "@/lib/errors"
import { getUserId } from "@/lib/auth-helpers"
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/user"
import { revalidatePath } from "next/cache"
import { signOut, unstable_update } from "@/auth"

/**
 * The name and avatar travel in the session JWT, which pages now render from: re-issue the
 * cookie in this response so a reload right after saving shows the new profile. The save
 * itself already succeeded, so a failed refresh is logged, not reported (the settings page
 * also asks the client session to update).
 */
async function refreshSessionProfile(): Promise<void> {
    try {
        await unstable_update({})
    } catch (error) {
        console.error("[updateUser] session refresh failed", error)
    }
}

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
        await refreshSessionProfile()

        return {
            success: true,
            data: updated,
        }
    } catch (error) {
        return { ...toActionError(error, "Failed to update profile") }
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

