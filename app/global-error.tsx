"use client"

import { useEffect } from "react"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-recovery"

/** Root-layout failures cannot rely on the theme, session or i18n providers. */
export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application initialization failed", error)
    if (isChunkLoadError(error)) reloadOnceForChunkError()
  }, [error])
  const retry = () => {
    if (isChunkLoadError(error)) window.location.reload()
    else reset()
  }
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ maxWidth: "30rem", margin: "15vh auto", padding: "2rem" }}>
          <h1>LingoCon could not load</h1>
          <p>Please try again. If the problem continues, include the reference below when reporting it.</p>
          {error.digest && <p>Reference: {error.digest}</p>}
          <button onClick={retry} style={{ padding: ".75rem 1rem" }}>Try again</button>
          {/* A full page load on purpose: the root layout itself failed, so client navigation is not trustworthy. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <p><a href="/">Go to the homepage</a></p>
        </main>
      </body>
    </html>
  )
}
