"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { signOut } from "@/auth"
import { generateVerificationToken, generatePasswordResetToken, consumeVerificationToken, consumePasswordResetToken } from "@/lib/tokens"
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email"

const signUpSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function registerUser(formData: FormData) {
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
        signUpSchema.parse({ name, email, password })

        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return { error: "User with this email already exists" }
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        })

        const { token, isNew } = await generateVerificationToken(email)
        if (isNew) {
            await sendVerificationEmail(email, token)
        }

        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: "Something went wrong. Please try again." }
    }
}

export async function verifyEmail(token: string) {
    try {
        const email = await consumeVerificationToken(token)

        if (!email) {
            return { error: "Invalid or expired verification link. Please request a new one." }
        }

        await prisma.user.update({
            where: { email },
            data: { emailVerified: new Date() },
        })

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function resendVerificationEmail(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            // Don't reveal whether the user exists
            return { success: true }
        }

        if (user.emailVerified) {
            return { error: "Email is already verified." }
        }

        const { token, isNew } = await generateVerificationToken(email)
        if (isNew) {
            await sendVerificationEmail(email, token)
        }

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function requestPasswordReset(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        })

        // Don't reveal whether the user exists
        if (!user || !user.password) {
            return { success: true }
        }

        const { token, isNew } = await generatePasswordResetToken(email)
        if (isNew) {
            await sendPasswordResetEmail(email, token)
        }

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function resetPassword(token: string, newPassword: string) {
    try {
        if (newPassword.length < 8) {
            return { error: "Password must be at least 8 characters." }
        }

        const email = await consumePasswordResetToken(token)

        if (!email) {
            return { error: "Invalid or expired reset link. Please request a new one." }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
        })

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function handleSignOut() {
    await signOut()
}
