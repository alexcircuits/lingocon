"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cookie } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

/**
 * Informational cookie notice. LingoCon only sets cookies it needs to work (sign-in, chosen
 * language) and counts visits without cookies, so there is nothing to consent to: the notice says
 * so once and links to /cookies. Dismissal is remembered in localStorage, not in a cookie.
 */

export const COOKIE_NOTICE_KEY = "lingocon-cookie-notice-dismissed"
/** Fired on window when the notice is closed, so other bottom banners can wait for it. */
export const COOKIE_NOTICE_DISMISSED_EVENT = "lingocon:cookie-notice-dismissed"

// Also remembered in memory, for browsers that block storage.
let dismissedThisPage = false

/** For tests. */
export function __resetCookieNotice(): void {
    dismissedThisPage = false
}

export function isCookieNoticeDismissed(): boolean {
    if (dismissedThisPage) return true
    try {
        return localStorage.getItem(COOKIE_NOTICE_KEY) === "1"
    } catch {
        // Storage blocked (private mode, site data disabled): show the notice once per page load.
        return false
    }
}

export function CookieNotice() {
    const t = useTranslations("cookies.notice")
    const [visible, setVisible] = useState(false)

    // Only after hydration: the server cannot know whether this browser dismissed it.
    useEffect(() => {
        setVisible(!isCookieNoticeDismissed())
    }, [])

    if (!visible) return null

    const dismiss = () => {
        setVisible(false)
        dismissedThisPage = true
        try {
            localStorage.setItem(COOKIE_NOTICE_KEY, "1")
        } catch {
            // Storage blocked: closed for this page only.
        }
        window.dispatchEvent(new Event(COOKIE_NOTICE_DISMISSED_EVENT))
    }

    return (
        <section
            aria-label={t("label")}
            className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] sm:right-auto sm:max-w-md rounded-xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none"
        >
            <div className="flex items-start gap-3">
                <Cookie className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 space-y-3">
                    <p className="text-sm leading-relaxed text-foreground">{t("message")}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button size="sm" onClick={dismiss}>
                            {t("dismiss")}
                        </Button>
                        <Link href="/cookies" className="text-sm text-primary underline-offset-4 hover:underline">
                            {t("learnMore")}
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
