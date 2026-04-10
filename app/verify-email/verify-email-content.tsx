"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { verifyEmail, resendVerificationEmail } from "@/app/actions/user-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"
import Link from "next/link"

export function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [resendEmail, setResendEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    if (!token) return

    verifyEmail(token).then((result) => {
      if (result.error) {
        setStatus("error")
        setErrorMessage(result.error)
      } else {
        setStatus("success")
      }
    })
  }, [token])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail) return
    setResendLoading(true)

    const result = await resendVerificationEmail(resendEmail)
    if (result.error) {
      setErrorMessage(result.error)
    } else {
      setResendSent(true)
    }
    setResendLoading(false)
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center py-6 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Verifying your email...</p>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center py-6 space-y-4">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-center font-medium">Your email has been verified!</p>
        <p className="text-sm text-muted-foreground text-center">
          You can now sign in to your account.
        </p>
        <Button asChild className="w-full mt-2">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center py-6 space-y-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <p className="text-center font-medium">{errorMessage}</p>
        <div className="w-full space-y-4 mt-2">
          <p className="text-sm text-muted-foreground text-center">
            Enter your email to receive a new verification link.
          </p>
          {resendSent ? (
            <p className="text-sm text-green-600 text-center">
              If an account exists with that email, a new verification link has been sent.
            </p>
          ) : (
            <form onSubmit={handleResend} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="resend-email">Email</Label>
                <Input
                  id="resend-email"
                  type="email"
                  placeholder="name@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={resendLoading}>
                {resendLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Resend Verification Email
              </Button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // no-token state - show resend form
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Check your email for a verification link. If you didn&apos;t receive one, enter your email below.
      </p>
      {resendSent ? (
        <p className="text-sm text-green-600 text-center py-4">
          If an account exists with that email, a new verification link has been sent.
        </p>
      ) : (
        <form onSubmit={handleResend} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="resend-email">Email</Label>
            <Input
              id="resend-email"
              type="email"
              placeholder="name@example.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={resendLoading}>
            {resendLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Resend Verification Email
          </Button>
        </form>
      )}
    </div>
  )
}
