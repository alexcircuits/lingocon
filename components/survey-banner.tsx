"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X, ClipboardList, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

const DISMISS_KEY = "lingocon-survey-banner-dismissed"

export function SurveyBanner() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const dismissed = localStorage.getItem(DISMISS_KEY)
        const completed = localStorage.getItem("lingocon-survey-completed")
        if (!dismissed && !completed) {
            // Small delay for a nicer entrance on page load
            const timer = setTimeout(() => setIsVisible(true), 1500)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleDismiss = () => {
        setIsVisible(false)
        localStorage.setItem(DISMISS_KEY, "true")
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="fixed bottom-8 left-0 right-0 mx-4 sm:mx-auto max-w-lg z-[999]"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl shadow-primary/10">
                        {/* Gradient accent */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-primary" />

                        <div className="p-5">
                            <button
                                onClick={handleDismiss}
                                className="absolute top-3 right-3 z-20 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground/60 hover:text-foreground"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </button>

                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
                                    <ClipboardList className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm mb-1">
                                        📋 Help us learn about our community!
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                                        Take a quick anonymous survey — it only takes a minute.
                                    </p>
                                    <Link
                                        href="/survey"
                                        onClick={handleDismiss}
                                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
                                    >
                                        Take the survey
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
