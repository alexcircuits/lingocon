"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  hover?: "lift" | "scale" | "glow" | "none"
  delay?: number
}

export function AnimatedCard({
  children,
  className,
  hover = "lift",
  delay = 0,
}: AnimatedCardProps) {
  const hoverVariants: Record<string, { hover?: any; tap?: any }> = {
    lift: {
      hover: { y: -4 },
      tap: { y: 0 },
    },
    scale: {
      hover: { scale: 1.02 },
      tap: { scale: 0.98 },
    },
    glow: {
      hover: { boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)" },
      tap: {},
    },
    none: {},
  }

  const variant = hoverVariants[hover] || {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={variant.hover}
      whileTap={variant.tap}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

