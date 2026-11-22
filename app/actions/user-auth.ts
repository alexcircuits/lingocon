"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { signOut } from "@/auth"
import { generateVerificationToken, generatePasswordResetToken, consumeVerificationToken, consumePasswordResetToken, cancelEmailChange, cancelPasswordReset } from "@/lib/tokens"
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
async function throttled(action: string, email: string | null, perIp: number, perEmail: number, windowMs: number): Promise<boolean> {
    const ip = clientIpFromHeaders(await headers())
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
        if (await throttled("register", null, 10, 0, 60 * 60_000)) return TOO_MANY

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
        if (await throttled("verify-resend", email, 10, 3, 60 * 60_000)) return TOO_MANY
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

/**
 * Accounts that sign in only with Google or GitHub have no password, and once that sign-in
 * is lost the mailbox is the only way back in. A reset link lets them set a first password,
 * but only for an address confirmed (a confirmed email change sets `emailVerified`) at least
 * this long ago. Moving such an account to another mailbox needs no password, so without the
 * wait a borrowed session could do that and at once give itself a lasting password. Within
 * it, the owner (told at the old address) can sign in with the provider and move it back,
 * which also voids reset links for the other address. Once a password exists that move-back
 * needs it, so the wait is the owner's only window: it narrows that risk, it does not remove it.
 */
const FIRST_PASSWORD_DELAY_MS = 72 * 60 * 60_000

function canSetFirstPassword(emailVerified: Date | null): boolean {
    return emailVerified !== null && Date.now() - emailVerified.getTime() >= FIRST_PASSWORD_DELAY_MS
}

export async function requestPasswordReset(rawEmail: string): Promise<AuthActionResult> {
    try {
        const email = normalizeEmail(String(rawEmail ?? ""))
        if (await throttled("password-reset", email, 10, 3, 60 * 60_000)) return TOO_MANY
        const user = await findUserByEmail(email)

        // Don't reveal whether the user exists.
        if (!user || !user.email || (!user.password && !canSetFirstPassword(user.emailVerified))) {
            return { success: true }
        }

        const { token, isNew } = await generatePasswordResetToken(user.email)
        if (isNew) {
            try {
                await sendPasswordResetEmail(user.email, token)
            } catch (error) {
                // Same answer as for an unknown address (no account enumeration), but the
                // unsent link must go: kept, it would stop a retry from sending a new one.
                console.error("[requestPasswordReset] reset email failed", error)
                try {
                    await cancelPasswordReset(user.email)
                } catch (cleanupError) {
                    // Still the unknown-address answer: an error here would reveal the account.
                    console.error("[requestPasswordReset] dropping the unsent link failed", cleanupError)
                }
            }
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
        if (await throttled("password-reset-consume", null, 20, 0, 60 * 60_000)) return TOO_MANY

        const email = await consumePasswordResetToken(token)

        if (!email) {
            return { error: "Invalid or expired reset link. Please request a new one." }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        const user = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
            select: { id: true },
        })

        // A pending email change was requested with the old password. The owner resetting it
        // through their mailbox is how they stop a change they did not ask for.
        try {
            await cancelEmailChange(user.id)
        } catch (error) {
            console.error("[resetPassword] cancelling a pending email change failed", error)
        }

        return { success: true }
    } catch (error) {
        return { error: "Something went wrong. Please try again." }
    }
}

export async function handleSignOut() {
    await signOut()
}
