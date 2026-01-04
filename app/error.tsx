"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, Home } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-secondary/30">
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      
      <Card className="w-full max-w-sm text-center border-border/40 shadow-soft relative z-10">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription className="text-sm">
            An unexpected error occurred
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-6 space-y-4">
          {error.message && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border/40">
              {error.message}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={reset} variant="outline" size="sm">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try Again
            </Button>
            <Link href="/">
              <Button size="sm" className="w-full sm:w-auto glow-primary">
                <Home className="mr-1.5 h-3.5 w-3.5" />
                Go Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
