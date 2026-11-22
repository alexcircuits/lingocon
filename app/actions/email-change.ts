"use server"

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { z } from "zod"

import { unstable_update } from "@/auth"
import { getUserId } from "@/lib/auth-helpers"
import { sendEmailChangeConfirmation, sendEmailChangedNotice, sendEmailChangeRequestedNotice } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders, ipRateLimitKey, normalizeEmail } from "@/lib/request-ip"
import {
    cancelEmailChange,
    consumeEmailChangeToken,
    generateEmailChangeToken,
    getPendingEmailChange,
    peekEmailChangeToken,
} from "@/lib/tokens"

/**
 * Changing the email address of an account.
 *
 * The address only changes after the owner of the NEW mailbox opens a link sent there and
 * confirms. Asking for the change needs the current password when the account has one, so a
 * borrowed session cannot move the account to another mailbox and then reset the password.
 * The current address is told when a change is requested (resetting the password from that
 * mailbox cancels it) and again once the change went through.
 *
 * Accounts that only sign in with Google or GitHub have no password to ask for. Their
 * sign-in is tied to the provider account, not to this address, so the change does not
 * affect how they sign in. The password-reset flow lets them set a first password only once
 * the new address has been confirmed for a few days (see `requestPasswordReset`), so a
 * borrowed session that moves the account cannot also take it over with a password.
 */

const HOUR_MS = 60 * 60_000
const REQUESTS_PER_USER_PER_HOUR = 5
const REQUESTS_PER_IP_PER_HOUR = 20
const LINK_USES_PER_IP_PER_HOUR = 30

const UNAUTHORIZED = { error: "Unauthorized" } as const
const TOO_MANY = { error: "Too many attempts. Please wait a few minutes and try again." } as const
const INVALID_LINK = {
    error: "This link is invalid or has expired. Request the change again from your settings.",
} as const
const EMAIL_TAKEN = { error: "That email is already used by another account." } as const
const FAILED = { error: "Something went wrong. Please try again." } as const
const FAILED_LINK_SPENT = {
    error: "Something went wrong and this link can no longer be used. Request the change again from your settings.",
} as const

const newEmailSchema = z.string().email().max(254)

export type EmailSettings = {
    email: string | null
    hasPassword: boolean
    /** Sign-in providers linked to the account, e.g. "google", "github". */
    providers: string[]
    /** An address waiting for confirmation, if a change was requested. */
    pendingEmail: string | null
}

type ActionResult = { success?: boolean; error?: string }

async function clientIpKey(): Promise<string> {
    return ipRateLimitKey(clientIpFromHeaders(await headers()))
}

function isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"
}

/** Emails were stored as typed, so "taken" has to be checked case-insensitively. */
function findUserByEmail(email: string) {
    return prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
    })
}

export async function getEmailSettings(): Promise<EmailSettings | { error: string }> {
    const userId = await getUserId()
    if (!userId) return UNAUTHORIZED

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, password: true, accounts: { select: { provider: true } } },
        })
        if (!user) return UNAUTHORIZED

        return {
            email: user.email,
            hasPassword: Boolean(user.password),
            providers: user.accounts.map((account) => account.provider),
            pendingEmail: await getPendingEmailChange(userId),
        }
    } catch (error) {
        console.error("[getEmailSettings]", error)
        return FAILED
    }
}

export async function requestEmailChange(input: {
    newEmail: string
    currentPassword?: string
}): Promise<ActionResult & { pendingEmail?: string }> {
    const userId = await getUserId()
    if (!userId) return UNAUTHORIZED

    const newEmail = normalizeEmail(String(input?.newEmail ?? ""))
    if (!newEmailSchema.safeParse(newEmail).success) {
        return { error: "Enter a valid email address." }
    }

    try {
        // Counted before the password check: this endpoint must not become a way to guess it.
        const withinLimits =
            rateLimit(`email-change:user:${userId}`, REQUESTS_PER_USER_PER_HOUR, HOUR_MS).ok &&
            rateLimit(`email-change:ip:${await clientIpKey()}`, REQUESTS_PER_IP_PER_HOUR, HOUR_MS).ok
        if (!withinLimits) return TOO_MANY

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, password: true },
        })
        if (!user) return UNAUTHORIZED

        if (user.password) {
            const currentPassword = String(input?.currentPassword ?? "")
            if (!currentPassword) {
                return { error: "Enter your current password to change your email." }
            }
            if (!(await bcrypt.compare(currentPassword, user.password))) {
                return { error: "Current password is incorrect." }
            }
        }

        if (user.email && normalizeEmail(user.email) === newEmail) {
            return { error: "That is already your email address." }
        }

        if (await findUserByEmail(newEmail)) return EMAIL_TAKEN

        const { token, isNew } = await generateEmailChangeToken(userId, newEmail)
        if (isNew) {
            try {
                await sendEmailChangeConfirmation(newEmail, token)
            } catch (error) {
                console.error("[requestEmailChange] confirmation email failed", error)
                // Without the email the link cannot be used: drop it so a retry sends a fresh one.
                await cancelEmailChange(userId)
                return { error: "We could not send the confirmation email. Please try again." }
            }
            if (user.email) {
                try {
                    await sendEmailChangeRequestedNotice(user.email, newEmail)
                } catch (error) {
                    // A courtesy warning: the request itself went through.
                    console.error("[requestEmailChange] warning to the current address failed", error)
                }
            }
        }

        return { success: true, pendingEmail: newEmail }
    } catch (error) {
        console.error("[requestEmailChange]", error)
        return FAILED
    }
}

export async function cancelPendingEmailChange(): Promise<ActionResult> {
    const userId = await getUserId()
    if (!userId) return UNAUTHORIZED

    try {
        await cancelEmailChange(userId)
        return { success: true }
    } catch (error) {
        console.error("[cancelPendingEmailChange]", error)
        return FAILED
    }
}

/** For the confirmation page: which address a link is for, without using the link up. */
export async function previewEmailChange(
    token: string,
): Promise<{ newEmail?: string; otherAccount?: boolean; error?: string }> {
    if (!token) return INVALID_LINK

    try {
        if (!rateLimit(`email-change-link:ip:${await clientIpKey()}`, LINK_USES_PER_IP_PER_HOUR, HOUR_MS).ok) {
            return TOO_MANY
        }
        const request = await peekEmailChangeToken(String(token))
        if (!request) return INVALID_LINK
        // Signed in here as someone else: the page must say the link is not for this account.
        const viewerId = await getUserId()
        return { newEmail: request.newEmail, otherAccount: Boolean(viewerId) && viewerId !== request.userId }
    } catch (error) {
        console.error("[previewEmailChange]", error)
        return FAILED
    }
}

/**
 * Completes the change. Needs no session: opening the link proves control of the new
 * mailbox, and the link itself names the account (it may be opened on another device).
 */
export async function confirmEmailChange(token: string): Promise<ActionResult & { email?: string }> {
    if (!token) return INVALID_LINK

    try {
        if (!rateLimit(`email-change-link:ip:${await clientIpKey()}`, LINK_USES_PER_IP_PER_HOUR, HOUR_MS).ok) {
            return TOO_MANY
        }

        const request = await consumeEmailChangeToken(String(token))
        if (!request) return INVALID_LINK

        try {
            const user = await prisma.user.findUnique({
                where: { id: request.userId },
                select: { id: true, email: true, isSuspended: true },
            })
            // A suspended account is locked as it is (its sessions are ignored as well).
            if (!user || user.isSuspended) return INVALID_LINK

            // The address was free when the link was sent; someone may have taken it since.
            const holder = await findUserByEmail(request.newEmail)
            if (holder && holder.id !== user.id) return EMAIL_TAKEN

            const oldEmail = user.email
            try {
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: user.id },
                        data: { email: request.newEmail, emailVerified: new Date() },
                    }),
                    // Sign-up and password-reset links sent to the old mailbox must stop working.
                    ...(oldEmail
                        ? [
                              prisma.verificationToken.deleteMany({
                                  where: { identifier: { in: [oldEmail, `pwd-reset:${oldEmail}`] } },
                              }),
                          ]
                        : []),
                ])
            } catch (error) {
                if (isUniqueViolation(error)) return EMAIL_TAKEN
                throw error
            }

            // Any other link this account still has out (requests can overlap) must not move it again.
            try {
                await cancelEmailChange(user.id)
            } catch (error) {
                console.error("[confirmEmailChange] clearing other pending requests failed", error)
            }

            if (oldEmail) {
                try {
                    await sendEmailChangedNotice(oldEmail, request.newEmail)
                } catch (error) {
                    // The change is done; a failed courtesy notice must not report it as failed.
                    console.error("[confirmEmailChange] notice to the previous address failed", error)
                }
            }

            // The email travels in the session token: re-issue it when this browser is signed in
            // to the account that just changed. Other sessions pick it up on their next update.
            if ((await getUserId()) === user.id) {
                try {
                    await unstable_update({})
                } catch (error) {
                    console.error("[confirmEmailChange] session refresh failed", error)
                }
            }

            return { success: true, email: request.newEmail }
        } catch (error) {
            // The link was used up above: "try again" would be a dead end.
            console.error("[confirmEmailChange]", error)
            return FAILED_LINK_SPENT
        }
    } catch (error) {
        console.error("[confirmEmailChange]", error)
        return FAILED
    }
}
