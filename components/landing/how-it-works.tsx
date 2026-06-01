"use client"

import { motion } from "motion/react"
import type { HowItWorksStep } from "@/lib/landing-content"

export function HowItWorks({ steps }: { steps: HowItWorksStep[] }) {
    return (
        <div className="relative mx-auto max-w-5xl">
            {/* Connecting line (desktop) */}
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />

            <div className="grid gap-10 md:grid-cols-3 md:gap-8">
                {steps.map((step, i) => (
                    <motion.div
                        key={step.step}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.5, delay: i * 0.12, ease: [0.21, 0.47, 0.32, 0.98] }}
                        className="relative text-center md:text-left"
                    >
                        <div className="mb-5 flex justify-center md:justify-start">
                            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card font-mono text-lg font-semibold text-primary shadow-soft">
                                {step.step}
                            </span>
                        </div>
                        <h3 className="mb-2 font-serif text-2xl font-medium text-foreground">
                            {step.title}
                        </h3>
                        <p className="text-[15px] leading-relaxed text-muted-foreground">
                            {step.description}
                        </p>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
