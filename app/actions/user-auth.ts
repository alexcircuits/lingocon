"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { signOut } from "@/auth"
import { generateVerificationToken, generatePasswordResetToken, consumeVerificationToken, consumePasswordResetToken } from "@/lib/tokens"
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email"
import { headers } from "next/headers"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders, normalizeEmail } from "@/lib/request-ip"

const signUpSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
    email: z.string().email("Invalid email address").max(254),
    password: z.string().min(8, "Password must be at least 8 characters").max(200, "Password is too long"),
})

type AuthActionResult = { success?: boolean; error?: string }

const TOO_MANY: AuthActionResult = { error: "Too many attempts. Please wait a few minutes and try again." }

/** Per-IP and (optionally) per-email throttle for the unauthenticated account endpoints. */
function throttled(action: string, email: string | null, perIp: number, perEmail: number, windowMs: number) {
    const ip = clientIpFromHeaders(headers())
    if (!rateLimit(`${action}:ip:${ip}`, perIp, windowMs).ok) return true
    return email !== null && !rateLimit(`${action}:email:${email}`, perEmail, windowMs).ok
}

/** Emails were stored as typed; match case-insensitively so "Alice@x.com" can still sign in. */
function findUserByEmail(email: string) {
    return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
}

export async function registerUser(formData: FormData): Promise<AuthActionResult> {
    const name = formData.get("name") as string
    const email = normalizeEmail(String(formData.get("email") ?? ""))
    const password = formData.get("password") as string

    try {
        signUpSchema.parse({ name, email, password })
        if (throttled("register", null, 10, 0, 60 * 60_000)) return TOO_MANY

        const existingUser = await findUserByEmail(email)

        if (existingUser) {
            return { error: "User with this email already exists" }
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await prisma.user.create({
            data: {
                name: name.trim(),
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

export async function verifyEmail(token: string): Promise<AuthActionResult> {
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

export async function resendVerificationEmail(rawEmail: string): Promise<AuthActionResult> {
    try {
        const email = normalizeEmail(String(rawEmail ?? ""))
        if (throttled("verify-resend", email, 10, 3, 60 * 60_000)) return TOO_MANY
        const user = await findUserByEmail(email)

        if (!user) {
            // Don't reveal whether the user exists
            return { success: true }
        }

        if (user.emailVerified) {
            return { error: "Email is already verified." }
        }

        const { token, isNew } = await generateVerificationToken(user.email!)
        if (isNew) {
            await sendVerificationEmail(user.email!, token)
        }

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function requestPasswordReset(rawEmail: string): Promise<AuthActionResult> {
    try {
        const email = normalizeEmail(String(rawEmail ?? ""))
        if (throttled("password-reset", email, 10, 3, 60 * 60_000)) return TOO_MANY
        const user = await findUserByEmail(email)

        // Don't reveal whether the user exists
        if (!user || !user.password) {
            return { success: true }
        }

        const { token, isNew } = await generatePasswordResetToken(user.email!)
        if (isNew) {
            await sendPasswordResetEmail(user.email!, token)
        }

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthActionResult> {
    try {
        if (newPassword.length < 8) {
            return { error: "Password must be at least 8 characters." }
        }
        if (newPassword.length > 200) {
            return { error: "Password is too long." }
        }
        if (throttled("password-reset-consume", null, 20, 0, 60 * 60_000)) return TOO_MANY

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
