"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X, Share } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showIOSBanner, setShowIOSBanner] = useState(false)
    const [dismissed, setDismissed] = useState(true) // Start hidden, show only after checks pass

    useEffect(() => {
        // Permanently dismissed — never bother them again
        if (localStorage.getItem("pwa-install-dismissed")) return

        // Already installed as PWA — no need
        if (window.matchMedia("(display-mode: standalone)").matches) return

        // Chrome/Edge/Android: intercept the native install prompt
        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setDismissed(false)
        }
        window.addEventListener("beforeinstallprompt", handler)

        // iOS Safari: show banner after 30 seconds (don't nag on first visit)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        let iosTimer: ReturnType<typeof setTimeout>
        if (isIOS && isSafari) {
            iosTimer = setTimeout(() => {
                setShowIOSBanner(true)
                setDismissed(false)
            }, 30000)
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handler)
            if (iosTimer) clearTimeout(iosTimer)
        }
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        if (choice.outcome === "accepted") {
            setDeferredPrompt(null)
            setDismissed(true)
            localStorage.setItem("pwa-install-dismissed", "1")
        }
    }

    const handleDismiss = () => {
        setDismissed(true)
        setShowIOSBanner(false)
        setDeferredPrompt(null)
        localStorage.setItem("pwa-install-dismissed", "1") // Permanent — never show again
    }

    // Hidden if dismissed or nothing to show
    if (dismissed) return null
    if (!deferredPrompt && !showIOSBanner) return null

    // Chrome/Edge/Android: install button in navbar
    if (deferredPrompt) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={handleInstall}
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Install App</span>
            </Button>
        )
    }

    // iOS: bottom banner with instructions
    if (showIOSBanner) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border/60 shadow-lg animate-in slide-in-from-bottom duration-300">
                <div className="container mx-auto flex items-center gap-3 max-w-lg">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
                        L
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Install LingoCon</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Tap <Share className="h-3 w-3 inline" /> then &quot;Add to Home Screen&quot;
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleDismiss}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    return null
}
