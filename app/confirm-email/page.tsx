import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { auth } from "@/auth"
import { LogoMark } from "@/components/brand/logo-mark"
import { Navbar } from "@/components/navbar"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmEmailContent } from "./confirm-email-content"

export const metadata = {
  title: "Confirm New Email",
  robots: { index: false, follow: false },
}

/** Landing page of the link sent to a new address when an account's email is being changed. */
export default async function ConfirmEmailPage() {
  // The link is often opened while signed in (same browser as the settings page): show the
  // account in the navbar then, instead of a "Sign in" button.
  const session = await auth()
  const user = session?.user?.id
    ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image }
    : null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-background via-transparent to-background"></div>

      <Navbar user={user} isDevMode={process.env.DEV_MODE === "true"} />
      <div className="h-14" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="text-center space-y-2">
            <LogoMark className="inline-block h-12 w-12 mb-4" />
            <h1 className="text-2xl font-semibold tracking-tight">Confirm your new email</h1>
          </div>

          <Card className="border-border/60 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <Suspense fallback={null}>
                <ConfirmEmailContent />
              </Suspense>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link
              href="/settings"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
