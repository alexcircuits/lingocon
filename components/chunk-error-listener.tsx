"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { isChunkLoadError } from "@/lib/chunk-recovery"

const TOAST_ID = "lingocon-new-version"

function isStaleAssetElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLScriptElement || target instanceof HTMLLinkElement)) return false
  const url = target instanceof HTMLScriptElement ? target.src : target.href
  return typeof url === "string" && url.includes("/_next/static/")
}

/**
 * Chunk failures that escape every error boundary (a lazy dialog opened from an
 * event handler, a stylesheet for a lazily rendered component) leave the page
 * running on a deleted build. The page may still hold unsaved input, so offer a
 * reload instead of forcing one.
 */
export function ChunkErrorListener() {
  const t = useTranslations("errors")

  useEffect(() => {
    const offerReload = () => {
      toast(t("newVersionAvailable"), {
        id: TOAST_ID,
        duration: Infinity,
        action: { label: t("reload"), onClick: () => window.location.reload() },
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) offerReload()
    }
    const onError = (event: Event) => {
      if (event instanceof ErrorEvent ? isChunkLoadError(event.error ?? event.message) : isStaleAssetElement(event.target)) {
        offerReload()
      }
    }

    window.addEventListener("unhandledrejection", onRejection)
    // Capture phase: resource load errors on <script>/<link> do not bubble.
    window.addEventListener("error", onError, true)
    return () => {
      window.removeEventListener("unhandledrejection", onRejection)
      window.removeEventListener("error", onError, true)
    }
  }, [t])

  return null
}
