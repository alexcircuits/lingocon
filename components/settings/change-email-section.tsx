"use client"

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Loader2, Mail } from "lucide-react"

import {
    cancelPendingEmailChange,
    getEmailSettings,
    requestEmailChange,
    type EmailSettings,
} from "@/app/actions/email-change"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub" }

function providerList(providers: string[]): string {
    return providers.map((provider) => PROVIDER_NAMES[provider] ?? provider).join(" or ")
}

type ChangeEmailSectionProps = {
    /** The address in the session, shown until the account's own settings have loaded. */
    sessionEmail?: string | null
    /** Called when the account's address differs from the session's (changed in another browser). */
    onSessionOutOfDate?: () => void
}

/**
 * The email row of the account settings: shows the address, and lets the user ask to
 * change it. The address only changes once the link sent to the new one is confirmed.
 */
export function ChangeEmailSection({ sessionEmail, onSessionOutOfDate }: ChangeEmailSectionProps) {
    const [settings, setSettings] = useState<EmailSettings | null>(null)
    const [editing, setEditing] = useState(false)
    const [newEmail, setNewEmail] = useState("")
    const [currentPassword, setCurrentPassword] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const emailId = useId()
    const passwordId = useId()

    // The address the session was last asked to catch up with, so it is asked once per change.
    const refreshedFor = useRef<string | null | undefined>(undefined)

    useEffect(() => {
        let cancelled = false
        getEmailSettings()
            .then((result) => {
                if (cancelled || "error" in result) return
                setSettings(result)
            })
            .catch(() => {
                // The row still shows the session's address; changing it stays unavailable.
            })
        return () => {
            cancelled = true
        }
    }, [])

    // The session may load after the settings (or the other way round): compare once both are known.
    const accountEmail = settings ? settings.email : undefined
    useEffect(() => {
        if (accountEmail === undefined || sessionEmail === undefined) return
        if ((sessionEmail ?? null) === accountEmail) return
        if (refreshedFor.current === accountEmail) return
        refreshedFor.current = accountEmail
        onSessionOutOfDate?.()
    }, [accountEmail, sessionEmail, onSessionOutOfDate])

    const email = settings ? settings.email : sessionEmail
    const signsInWithProviderOnly = settings !== null && !settings.hasPassword && settings.providers.length > 0

    const closeForm = () => {
        setEditing(false)
        setNewEmail("")
        setCurrentPassword("")
        setError(null)
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        if (!settings || submitting) return
        setSubmitting(true)
        setError(null)
        try {
            const result = await requestEmailChange(
                settings.hasPassword ? { newEmail, currentPassword } : { newEmail },
            )
            if (result.error || !result.pendingEmail) {
                setError(result.error ?? "Something went wrong. Please try again.")
                return
            }
            setSettings({ ...settings, pendingEmail: result.pendingEmail })
            closeForm()
        } catch {
            setError("Something went wrong. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    const handleCancelRequest = async () => {
        if (!settings || cancelling) return
        setCancelling(true)
        try {
            const result = await cancelPendingEmailChange()
            if (!result.error) setSettings({ ...settings, pendingEmail: null })
        } finally {
            setCancelling(false)
        }
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Email Address</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{email || "No email address"}</span>
                </div>
                {!editing && (
                    <Button type="button" variant="outline" disabled={!settings} onClick={() => setEditing(true)}>
                        Change email
                    </Button>
                )}
            </div>
            <p className="text-[0.8rem] text-muted-foreground">
                {signsInWithProviderOnly
                    ? `You sign in with ${providerList(settings.providers)}. Changing this address does not change which ${providerList(settings.providers)} account you sign in with.`
                    : "Used to sign in and for emails about your account."}
            </p>

            {settings?.pendingEmail && (
                <div
                    role="status"
                    className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                    <p className="min-w-0">
                        We sent a confirmation link to <strong className="break-all">{settings.pendingEmail}</strong>. Open it
                        within 1 hour to finish. Until then your email stays the same.
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={cancelling}
                        onClick={handleCancelRequest}
                    >
                        {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        Cancel request
                    </Button>
                </div>
            )}

            {editing && settings && (
                <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-border/60 p-4">
                    <div className="space-y-2">
                        <Label htmlFor={emailId}>New email address</Label>
                        <Input
                            id={emailId}
                            type="email"
                            autoComplete="email"
                            placeholder="name@example.com"
                            value={newEmail}
                            onChange={(event) => setNewEmail(event.target.value)}
                            required
                            maxLength={254}
                            autoFocus
                        />
                    </div>
                    {settings.hasPassword && (
                        <div className="space-y-2">
                            <Label htmlFor={passwordId}>Current password</Label>
                            <Input
                                id={passwordId}
                                type="password"
                                autoComplete="current-password"
                                value={currentPassword}
                                onChange={(event) => setCurrentPassword(event.target.value)}
                                required
                            />
                        </div>
                    )}
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <p className="text-[0.8rem] text-muted-foreground">
                        We will email a link to the new address. Your email changes only after you open it.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            Send confirmation link
                        </Button>
                        <Button type="button" variant="ghost" disabled={submitting} onClick={closeForm}>
                            Cancel
                        </Button>
                    </div>
                </form>
            )}
        </div>
    )
}
