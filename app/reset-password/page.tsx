import { Card, CardContent } from "@/components/ui/card"
import { Languages, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { ResetPasswordForm } from "./reset-password-form"

export const metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-background via-transparent to-background"></div>

      <Navbar />
      <div className="h-14" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 mb-4">
              <Languages className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          <Card className="border-border/60 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <ResetPasswordForm />
            </CardContent>
          </Card>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
