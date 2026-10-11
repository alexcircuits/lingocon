"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Radio } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LiveStats } from "@/lib/stats/store"

const ENDPOINT = "/api/admin/stats/live"
const POLL_MS = 15_000

interface LiveTrafficProps {
    initial: LiveStats
    /** The dashboard shows the counts only, with a link to the Traffic page. */
    compact?: boolean
}

/** Hours, minutes and seconds in UTC: identical on the server and in the browser. */
const utcTime = (iso: string) => `${iso.slice(11, 19)} UTC`

/** Who is online now (counts only), refreshed every 15 s while the tab is visible. */
export function LiveTraffic({ initial, compact = false }: LiveTrafficProps) {
    const [stats, setStats] = useState(initial)
    const [problem, setProblem] = useState<"stale" | "forbidden" | null>(null)

    useEffect(() => {
        let active = true
        let latest = 0
        const stop = () => {
            active = false
            window.clearInterval(timer)
            document.removeEventListener("visibilitychange", onVisible)
        }
        const refresh = async () => {
            if (!active || document.visibilityState !== "visible") return
            const request = ++latest
            try {
                const res = await fetch(ENDPOINT, { cache: "no-store" })
                if (res.status === 403) {
                    // Signed out, or no longer an admin: polling again cannot help.
                    if (active) setProblem("forbidden")
                    stop()
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const next = (await res.json()) as LiveStats
                // A slow answer must not overwrite a newer one.
                if (active && request === latest) {
                    setStats(next)
                    setProblem(null)
                }
            } catch (error) {
                console.warn("[admin] live statistics refresh failed", error)
                if (active && request === latest) setProblem("stale")
            }
        }
        const onVisible = () => void refresh()
        const timer = window.setInterval(refresh, POLL_MS)
        document.addEventListener("visibilitychange", onVisible)
        return stop
    }, [])

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    Online now
                </CardTitle>
                <CardDescription>Active in the last minute · updated {utcTime(stats.at)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end gap-6">
                    <span data-testid="live-online" className="text-4xl font-semibold tabular-nums">
                        {stats.online}
                    </span>
                    <dl className="flex gap-4 text-sm text-muted-foreground pb-1">
                        <div>
                            <dt className="inline">Signed in </dt>
                            <dd className="inline font-medium text-foreground tabular-nums">{stats.signedIn}</dd>
                        </div>
                        <div>
                            <dt className="inline">Guests </dt>
                            <dd className="inline font-medium text-foreground tabular-nums">{stats.guests}</dd>
                        </div>
                    </dl>
                </div>
                {!compact && (
                    stats.pages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nobody is browsing right now.</p>
                    ) : (
                        <ul className="space-y-1 text-sm" aria-label="Pages open right now">
                            {stats.pages.map((page) => (
                                <li key={page.path} className="flex justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
                                    <code className="truncate text-xs" title={page.path}>{page.path}</code>
                                    <span className="tabular-nums text-muted-foreground">{page.visitors}</span>
                                </li>
                            ))}
                        </ul>
                    )
                )}
                {compact && (
                    <Link href="/admin/traffic" className="inline-block text-sm text-primary hover:underline">
                        Traffic details
                    </Link>
                )}
                <p role="status" className="text-xs text-amber-600 dark:text-amber-400 min-h-4">
                    {problem === "stale" && "Could not refresh; showing the last counts."}
                    {problem === "forbidden" && "Your admin session has ended. Reload the page to sign in again."}
                </p>
            </CardContent>
        </Card>
    )
}
