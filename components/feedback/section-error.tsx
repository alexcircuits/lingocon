"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-recovery"

interface SectionErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Inline error boundary for a route segment (studio, learn, lang, …).
 *
 * Unlike the full-screen root `app/error.tsx`, this renders within the section
 * layout so the user keeps their navigation/sidebar context. Next.js logs the
 * underlying error server-side via `error.digest`.
 */
export function SectionError({ error, reset }: SectionErrorProps) {
  const t = useTranslations("errors")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [retrying, startTransition] = useTransition()

  useEffect(() => {
    // This section's UI is already gone, so reloading loses nothing; a chunk
    // deleted by a deployment cannot be fixed by re-rendering.
    if (isChunkLoadError(error)) reloadOnceForChunkError()
  }, [error])

  const retry = () => {
    if (isChunkLoadError(error)) {
      window.location.reload()
      return
    }
    // `reset()` alone re-renders the failed server payload; refetch it first.
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">{t("somethingWrong")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("unexpectedError")}</p>
        {error.message && (
          <p className="mt-3 rounded-lg border border-border/40 bg-muted/50 p-3 text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
        <Button onClick={retry} disabled={retrying} variant="outline" size="sm" className="mt-4">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {tCommon("tryAgain")}
        </Button>
      </div>
    </div>
  )
}
