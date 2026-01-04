"use client"

import { useRef, useState } from "react"
import { motion } from "motion/react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface MagneticButtonProps extends React.ComponentProps<typeof Button> {
    children: React.ReactNode
    strength?: number
}

export function MagneticButton({ children, strength = 0.3, className, ...props }: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null)
    const [position, setPosition] = useState({ x: 0, y: 0 })

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e
        const { left, top, width, height } = ref.current!.getBoundingClientRect()

        const x = clientX - (left + width / 2)
        const y = clientY - (top + height / 2)

        setPosition({ x: x * strength, y: y * strength })
    }

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 })
    }

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            animate={{ x: position.x, y: position.y }}
            transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
            className="inline-block"
        >
            <Button ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
                {children}
            </Button>
        </motion.div>
    )
}
