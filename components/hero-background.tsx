"use client"

import { useEffect, useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"

export function HeroBackground() {
    const containerRef = useRef<HTMLDivElement>(null)
    const { scrollY } = useScroll()
    const y = useTransform(scrollY, [0, 500], [0, 200])
    const opacity = useTransform(scrollY, [0, 300], [1, 0])

    return (
        <div ref={containerRef} className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            {/* Base Grid */}
            <div className="absolute inset-0 bg-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            {/* Radial fade for the grid */}
            <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,transparent_70%,black)] [-webkit-mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,transparent_70%,black)]"></div>

            {/* Subtle "Syntax Tree" Lines */}
            <motion.div
                style={{ y, opacity }}
                className="absolute inset-0 max-w-6xl mx-auto opacity-20 dark:opacity-10"
            >
                <svg className="w-full h-full" viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">
                    {/* Main vertical trunk lines */}
                    <path d="M500 0 V800" stroke="currentColor" strokeWidth="1" className="text-foreground" strokeDasharray="4 4" />
                    <path d="M250 100 V800" stroke="currentColor" strokeWidth="1" className="text-foreground" strokeDasharray="4 4" />
                    <path d="M750 100 V800" stroke="currentColor" strokeWidth="1" className="text-foreground" strokeDasharray="4 4" />

                    {/* Connecting branches */}
                    <path d="M500 100 C 500 100 250 100 250 150" stroke="currentColor" strokeWidth="1" fill="none" className="text-foreground" />
                    <path d="M500 100 C 500 100 750 100 750 150" stroke="currentColor" strokeWidth="1" fill="none" className="text-foreground" />

                    <path d="M250 250 C 250 250 125 250 125 300" stroke="currentColor" strokeWidth="1" fill="none" className="text-foreground" />
                    <path d="M250 250 C 250 250 375 250 375 300" stroke="currentColor" strokeWidth="1" fill="none" className="text-foreground" />

                    {/* Decorative nodes */}
                    <circle cx="500" cy="100" r="3" fill="currentColor" className="text-primary" />
                    <circle cx="250" cy="150" r="3" fill="currentColor" className="text-primary" />
                    <circle cx="750" cy="150" r="3" fill="currentColor" className="text-primary" />
                    <circle cx="250" cy="250" r="3" fill="currentColor" className="text-primary" />
                </svg>
            </motion.div>
        </div>
    )
}
