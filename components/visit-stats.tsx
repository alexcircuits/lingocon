"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Anonymous visit counter: one beacon per page view and a keep-alive ping every 25 s while the tab
 * is visible, so the admin panel can show how many people are online. Sends only the path (no
 * query string) and, on the first view, the referrer; sets no cookie and stores nothing on the
 * device. Browsers that send Do Not Track or Global Privacy Control are not counted.
 */

const ENDPOINT = "/api/stats"
export const PING_INTERVAL_MS = 25_000

type Beacon = { type: "pageview"; path: string; referrer: string | null } | { type: "ping"; path: string }

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true
}

const counted = (path: string) => path !== "/admin" && !path.startsWith("/admin/")

function send(beacon: Beacon): void {
  const body = JSON.stringify(beacon)
  // A string body goes out as text/plain, which needs no CORS preflight and keeps cookies.
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, body)) return
  // Statistics are best effort: a lost beacon must never surface as an error to the visitor.
  fetch(ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    credentials: "same-origin",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
  }).catch(() => undefined)
}

export function VisitStats() {
  const pathname = usePathname()
  const current = useRef(pathname)
  const lastViewed = useRef<string | null>(null)
  const firstView = useRef(true)

  useEffect(() => {
    current.current = pathname
    // Effects can run twice for one navigation (Strict Mode); count the page once.
    if (lastViewed.current === pathname) return
    lastViewed.current = pathname
    // The referrer belongs to the page the visitor landed on, counted or not.
    const referrer = firstView.current ? document.referrer || null : null
    firstView.current = false
    if (!counted(pathname) || optedOut()) return
    send({ type: "pageview", path: pathname, referrer })
  }, [pathname])

  useEffect(() => {
    if (optedOut()) return
    const ping = () => {
      if (document.visibilityState === "visible" && counted(current.current)) send({ type: "ping", path: current.current })
    }
    const timer = window.setInterval(ping, PING_INTERVAL_MS)
    document.addEventListener("visibilitychange", ping)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", ping)
    }
  }, [])

  return null
}
