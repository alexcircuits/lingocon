"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FaqItem } from "@/lib/landing-content"

export function FaqSection({ items }: { items: FaqItem[] }) {
    const [open, setOpen] = useState<number | null>(0)

    return (
        <div className="mx-auto max-w-3xl divide-y divide-border/50 rounded-2xl border border-border/50 bg-card/40">
            {items.map((item, i) => {
                const isOpen = open === i
                return (
                    <div key={item.question} className="px-5 sm:px-6">
                        <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : i)}
                            aria-expanded={isOpen}
                            className="flex w-full items-center justify-between gap-4 py-5 text-left"
                        >
                            <span className="font-serif text-lg font-medium text-foreground">
                                {item.question}
                            </span>
                            <span
                                className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-transform duration-300",
                                    isOpen && "rotate-45 border-primary/40 bg-primary/10 text-primary"
                                )}
                            >
                                <Plus className="h-4 w-4" />
                            </span>
                        </button>
                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <p className="pb-5 pr-10 text-[15px] leading-relaxed text-muted-foreground">
                                        {item.answer}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    )
}
