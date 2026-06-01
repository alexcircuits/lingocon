"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"

// Carefully chosen Unicode characters from diverse writing systems
const FLOATING_GLYPHS = [
    "ᚱ", "愛", "ᚠ", "अ", "ع", "გ", "ы", "ש", "ⴀ",
    "ꦏ", "ᜀ", "ᓀ", "Ω", "θ", "Ψ", "ᛟ"
]

interface FloatingGlyph {
    id: number
    char: string
    x: number
    size: number
    duration: number
    delay: number
    opacity: number
    rotation: number
}

function generateGlyphs(count: number): FloatingGlyph[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        char: FLOATING_GLYPHS[i % FLOATING_GLYPHS.length],
        x: 5 + Math.random() * 90,
        size: 14 + Math.random() * 28,
        duration: 12 + Math.random() * 18,
        delay: Math.random() * -20,
        opacity: 0.04 + Math.random() * 0.1,
        rotation: -30 + Math.random() * 60,
    }))
}

export function HeroBackground() {
    const prefersReducedMotion = useReducedMotion()
    const { scrollY } = useScroll()
    const y = useTransform(scrollY, [0, 600], [0, 200])
    const opacity = useTransform(scrollY, [0, 400], [1, 0])

    const glyphs = useMemo(() => generateGlyphs(9), [])

    return (
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            {/* Layer 1: Animated Mesh Gradient */}
            <div className="hero-gradient-orb" />
            <div className="hero-gradient-orb-2" />

            {/* Layer 2: Subtle Grid */}
            <div className="absolute inset-0 bg-background bg-[linear-gradient(to_right,hsl(var(--foreground)/0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

            {/* Radial fade for the grid edges */}
            <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_70%_50%_at_50%_50%,transparent_30%,black)] [-webkit-mask-image:radial-gradient(ellipse_70%_50%_at_50%_50%,transparent_30%,black)]" />

            {/* Layer 3: Floating Glyphs */}
            {!prefersReducedMotion && (
                <motion.div style={{ y, opacity }} className="absolute inset-0">
                    {glyphs.map((glyph) => (
                        <div
                            key={glyph.id}
                            className="floating-glyph"
                            style={{
                                left: `${glyph.x}%`,
                                fontSize: `${glyph.size}px`,
                                animationDuration: `${glyph.duration}s`,
                                animationDelay: `${glyph.delay}s`,
                                opacity: glyph.opacity,
                                transform: `rotate(${glyph.rotation}deg)`,
                            }}
                        >
                            {glyph.char}
                        </div>
                    ))}
                </motion.div>
            )}

            {/* Layer 4: Top radial highlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_70%)]" />
        </div>
    )
}
