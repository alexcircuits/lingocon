"use client"

import { motion, Variants } from "motion/react"

interface TextRevealProps {
    text: string
    className?: string
    delay?: number
}

export function TextReveal({ text, className, delay = 0 }: TextRevealProps) {
    const words = text.split(" ")

    const container: Variants = {
        hidden: { opacity: 0 },
        visible: (i: number = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.12, delayChildren: 0.04 * i + delay },
        }),
    }

    const child: Variants = {
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 100,
            },
        },
        hidden: {
            opacity: 0,
            y: 20,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 100,
            },
        },
    }

    return (
        <motion.div
            style={{ display: "inline" }}
            variants={container}
            initial="hidden"
            animate="visible"
            className={className}
        >
            {words.map((word, index) => (
                <motion.span variants={child} style={{ marginRight: "0.25em", display: "inline-block" }} key={index}>
                    {word}
                </motion.span>
            ))}
        </motion.div>
    )
}
