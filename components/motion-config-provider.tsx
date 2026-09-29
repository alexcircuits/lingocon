"use client"

import { MotionConfig } from "motion/react"

/**
 * Honour the OS "reduce motion" setting for every motion/react animation in the app (the globe,
 * landing reveals, lesson feedback, the loading screen) instead of opting in per component.
 */
export function MotionConfigProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
