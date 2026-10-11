"use client"

import { useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

/** A tab hidden at least this long may be showing outdated project data. */
export const STALE_AFTER_HIDDEN_MS = 60_000

const TOAST_ID = "lingocon-studio-freshness"

/**
 * Keeps a background studio tab from silently presenting old project data as current.
 *
 * Another tab, a collaborator or a bulk job may have changed the project while this
 * tab was hidden. When the user comes back after a while, offer to re-read the server
 * data. Never refresh automatically: Next turns a refresh into a full page load when
 * the deployment changed or the request fails, which would discard unsaved drafts.
 * (Stale saves are still rejected on the server by revision checks and merges.)
 */
export function StudioFreshness() {
  const router = useRouter()
  const t = useTranslations("studio.common")
  const [, startTransition] = useTransition()
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now()
        return
      }
      const since = hiddenAt.current
      hiddenAt.current = null
      if (since === null || Date.now() - since < STALE_AFTER_HIDDEN_MS) return
      if (!navigator.onLine) return
      toast(t("mayHaveChanged"), {
        id: TOAST_ID,
        duration: 15_000,
        action: { label: t("refreshView"), onClick: () => startTransition(() => router.refresh()) },
      })
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [router, t])

  return null
}
