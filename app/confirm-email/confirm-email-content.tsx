"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { confirmEmailChange, previewEmailChange } from "@/app/actions/email-change"
import { Button } from "@/components/ui/button"

type State =
  | { step: "checking" }
  | { step: "ready"; newEmail: string; otherAccount: boolean }
  | { step: "confirming"; newEmail: string; otherAccount: boolean }
  | { step: "done"; email: string; otherAccount: boolean }
  | { step: "failed"; message: string }

const NO_TOKEN = "This link is incomplete. Open the link from the email again, or request the change again from your settings."

/**
 * Shows which address the link is for and changes the email only when the button is
 * pressed: mail scanners and link previews open links on their own, and must not be
 * able to complete the change.
 */
export function ConfirmEmailContent() {
  const token = useSearchParams().get("token")
  const { status, update } = useSession()
  const [state, setState] = useState<State>(token ? { step: "checking" } : { step: "failed", message: NO_TOKEN })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    previewEmailChange(token)
      .then((result) => {
        if (cancelled) return
        setState(
          result.newEmail
            ? { step: "ready", newEmail: result.newEmail, otherAccount: result.otherAccount === true }
            : { step: "failed", message: result.error ?? "Something went wrong. Please try again." },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ step: "failed", message: "Something went wrong. Please try again." })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleConfirm = async () => {
    if (!token || state.step !== "ready") return
    const { newEmail, otherAccount } = state
    setState({ step: "confirming", newEmail, otherAccount })
    try {
      const result = await confirmEmailChange(token)
      if (result.error || !result.email) {
        setState({ step: "failed", message: result.error ?? "Something went wrong. Please try again." })
        return
      }
      setState({ step: "done", email: result.email, otherAccount })
      // The server re-issued the session cookie; bring this tab's copy in line with it.
      if (status === "authenticated") void update()
    } catch {
      setState({ step: "failed", message: "Something went wrong. Please try again." })
    }
  }

  if (state.step === "checking") {
    return (
      <div className="flex flex-col items-center py-6 space-y-3" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">Checking your link…</p>
      </div>
    )
  }

  if (state.step === "done") {
    return (
      <div className="flex flex-col items-center py-6 space-y-4" role="status">
        <CheckCircle2 className="h-12 w-12 text-green-500" aria-hidden="true" />
        <p className="text-center font-medium">Your email was changed</p>
        <p className="text-sm text-muted-foreground text-center">
          Your LingoCon account now uses <strong className="break-all text-foreground">{state.email}</strong>. Use it the
          next time you sign in with email and password.
        </p>
        {/* Signed in here as another account: its settings would show a different address. */}
        {!state.otherAccount && (
          <Button asChild className="w-full mt-2">
            <Link href={status === "authenticated" ? "/settings" : "/login"}>
              {status === "authenticated" ? "Back to settings" : "Sign in"}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  if (state.step === "failed") {
    return (
      <div className="flex flex-col items-center py-6 space-y-4">
        <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
        <p role="alert" className="text-center font-medium">
          {state.message}
        </p>
        <Button asChild variant="outline" className="w-full mt-2">
          <Link href="/settings">Go to settings</Link>
        </Button>
      </div>
    )
  }

  const confirming = state.step === "confirming"
  return (
    <div className="flex flex-col items-center py-6 space-y-4">
      <p className="text-center">
        Change the email of your LingoCon account to{" "}
        <strong className="break-all">{state.newEmail}</strong>?
      </p>
      <p className="text-sm text-muted-foreground text-center">
        Your previous address will be told about the change and will no longer be linked to the account.
      </p>
      {state.otherAccount && (
        <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-center">
          You are signed in to a different LingoCon account in this browser. This link changes the email of the
          account that requested it, not the one signed in here.
        </p>
      )}
      <Button className="w-full mt-2" disabled={confirming} onClick={handleConfirm}>
        {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Confirm new email
      </Button>
    </div>
  )
}
