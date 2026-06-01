"use client"

import { motion, type MotionStyle, type Transition } from "motion/react"
import { cn } from "@/lib/utils"

interface BorderBeamProps {
    size?: number
    duration?: number
    delay?: number
    colorFrom?: string
    colorTo?: string
    transition?: Transition
    className?: string
    style?: React.CSSProperties
    reverse?: boolean
    initialOffset?: number
    borderWidth?: number
}

export const BorderBeam = ({
    className,
    size = 50,
    delay = 0,
    duration = 6,
    colorFrom = "#7c5cff",
    colorTo = "#ff4d9d",
    transition,
    style,
    reverse = false,
    initialOffset = 0,
    borderWidth = 1,
}: BorderBeamProps) => {
    return (
        <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent"
            style={{
                borderWidth: `${borderWidth}px`,
                WebkitMask:
                    "linear-gradient(transparent, transparent), linear-gradient(#000, #000)",
                WebkitMaskClip: "padding-box, border-box",
                WebkitMaskComposite: "source-in, xor" as unknown as string,
                maskComposite: "intersect",
            }}
        >
            <motion.div
                className={cn(
                    "absolute aspect-square bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent",
                    className,
                )}
                style={
                    {
                        width: size,
                        offsetPath: `rect(0 auto auto 0 round ${size}px)`,
                        "--color-from": colorFrom,
                        "--color-to": colorTo,
                        ...style,
                    } as MotionStyle
                }
                initial={{ offsetDistance: `${initialOffset}%` }}
                animate={{
                    offsetDistance: reverse
                        ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
                        : [`${initialOffset}%`, `${100 + initialOffset}%`],
                }}
                transition={{
                    repeat: Infinity,
                    ease: "linear",
                    duration,
                    delay: -delay,
                    ...transition,
                }}
            />
        </div>
    )
}
