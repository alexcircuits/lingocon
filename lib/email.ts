import { Resend, type CreateEmailOptions } from "resend"

// Created on first send, not at import: Resend throws without a key, and this module
// is imported by every auth action (sign-out included), so a missing key used to
// turn all of them into 500s.
let client: Resend | null | undefined

/**
 * Sends through Resend. Without RESEND_API_KEY (local, CI, a misconfigured server)
 * the email is not sent and an error is logged — the subject only, never the
 * recipient — instead of failing the action that triggered it.
 */
async function send(message: CreateEmailOptions): Promise<void> {
  client ??= process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (!client) {
    console.error(`[email] RESEND_API_KEY is not set; not sending "${message.subject}"`)
    return
  }
  await client.emails.send(message)
}

/**
 * Like `send`, but a refusal by the provider is an error. Resend does not throw on API
 * errors (unverified domain, rate limit…): it returns `{ error }`, which `send` ignores.
 * The email-change flow must not tell the user a link is on its way when it is not.
 */
async function sendOrThrow(message: CreateEmailOptions): Promise<void> {
  client ??= process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (!client) {
    console.error(`[email] RESEND_API_KEY is not set; not sending "${message.subject}"`)
    return
  }
  const result = await client.emails.send(message)
  if (result?.error) {
    // The provider's error name only: its message can quote the recipient.
    throw new Error(`[email] provider refused "${message.subject}": ${result.error.name}`)
  }
}

const FROM_EMAIL = process.env.EMAIL_FROM || "LingoCon <noreply@lingocon.com>"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${SITE_URL}/verify-email?token=${token}`

  await send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verify your email - LingoCon",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Verify your email address</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          Thanks for signing up for LingoCon! Please verify your email address by clicking the button below.
        </p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 14px; margin-top: 24px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #888; font-size: 12px;">
          This link expires in 24 hours.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`

  // A refused send must surface: the caller drops the link so asking again sends a new one.
  await sendOrThrow({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your password - LingoCon",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Reset your password</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 14px; margin-top: 24px;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color: #888; font-size: 12px;">
          This link expires in 1 hour.
        </p>
      </div>
    `,
  })
}

/** Addresses are validated before they get here; escaping keeps that from being load-bearing. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Sent to the NEW address: the account only moves there once this link is opened and confirmed. */
export async function sendEmailChangeConfirmation(newEmail: string, token: string) {
  const confirmUrl = `${SITE_URL}/confirm-email?token=${token}`

  await sendOrThrow({
    from: FROM_EMAIL,
    to: newEmail,
    subject: "Confirm your new email - LingoCon",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Confirm your new email address</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          Someone asked to use this address for their LingoCon account. If that was you, confirm it with the button below.
          Your account keeps its current email until you do.
        </p>
        <a href="${confirmUrl}"
           style="display: inline-block; background: #18181b; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
          Confirm New Email
        </a>
        <p style="color: #888; font-size: 14px; margin-top: 24px;">
          If you didn't ask for this, you can safely ignore this email. Nothing will change.
        </p>
        <p style="color: #888; font-size: 12px;">
          This link expires in 1 hour.
        </p>
      </div>
    `,
  })
}

/** Sent to the OLD address after the change went through. Carries no link that acts on the account. */
export async function sendEmailChangedNotice(oldEmail: string, newEmail: string) {
  const contactUrl = `${SITE_URL}/contact`

  await sendOrThrow({
    from: FROM_EMAIL,
    to: oldEmail,
    subject: "Your LingoCon email was changed",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Your email address was changed</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          The email address of your LingoCon account was changed to <strong>${escapeHtml(newEmail)}</strong>.
          This address is no longer linked to the account.
        </p>
        <p style="color: #4a4a4a; line-height: 1.6;">
          If you made this change, there is nothing else to do.
        </p>
        <p style="color: #888; font-size: 14px; margin-top: 24px;">
          If you did not make this change, someone else may have access to your account.
          <a href="${contactUrl}" style="color: #4a4a4a;">Contact us</a> right away.
        </p>
      </div>
    `,
  })
}

/**
 * Sent to the CURRENT address when a change is requested, before anything changes: its
 * owner may not be the one who asked. Carries no link that acts on the account.
 */
export async function sendEmailChangeRequestedNotice(currentEmail: string, newEmail: string) {
  const resetUrl = `${SITE_URL}/forgot-password`

  await sendOrThrow({
    from: FROM_EMAIL,
    to: currentEmail,
    subject: "An email change was requested for your LingoCon account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Email change requested</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          Someone signed in to your LingoCon account asked to change its email address to
          <strong>${escapeHtml(newEmail)}</strong>. Nothing has changed yet: the change only happens
          if the link sent to that address is confirmed within 1 hour.
        </p>
        <p style="color: #4a4a4a; line-height: 1.6;">
          If this was you, there is nothing to do here.
        </p>
        <p style="color: #888; font-size: 14px; margin-top: 24px;">
          If this was not you, someone else may know your password.
          <a href="${resetUrl}" style="color: #4a4a4a;">Reset your password</a> now: that also cancels this request.
        </p>
      </div>
    `,
  })
}
