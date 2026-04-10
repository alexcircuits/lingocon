"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { resetPassword } from "@/app/actions/user-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Loader2, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="flex flex-col items-center py-6 space-y-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <p className="text-center font-medium">Invalid reset link</p>
        <p className="text-sm text-muted-foreground text-center">
          Please request a new password reset link.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Request New Link</Link>
        </Button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center py-6 space-y-4">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-center font-medium">Password reset successfully!</p>
        <p className="text-sm text-muted-foreground text-center">
          You can now sign in with your new password.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setIsLoading(true)
    const result = await resetPassword(token, password)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="mr-2 h-4 w-4" />
        )}
        Reset Password
      </Button>
    </form>
  )
}
